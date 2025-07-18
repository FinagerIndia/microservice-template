import { FileModel, FileInput, FileSchema } from './files.model';
import APIError from '../../lib/errors/APIError';
import { AUTHORIZATION_ERRORS } from '../../lib/errors/AUTHORIZATION_ERRORS';
import fs from 'fs/promises';
import path from 'path';
import { Request } from 'express';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import env from '@/configs/env';
import { CompressionService, CompressionResult } from './compression.service';
import logger from '@/configs/logger';

export interface FileUploadOptions {
  uploadedBy: string;
  uploadedFor?: string;
  entityType?:
    | 'kpi-entry'
    | 'user-profile'
    | 'department'
    | 'template'
    | 'other';
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  expiresAt?: Date;
}

export interface FileQueryOptions {
  uploadedBy?: string;
  uploadedFor?: string;
  entityType?: string;
  isPublic?: boolean;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  // Metadata filters
  hasLocation?: boolean;
  hasImageMetadata?: boolean;
  latitude?: number;
  longitude?: number;
  radius?: number; // in kilometers
  deviceMake?: string;
  deviceModel?: string;
}

export interface FileWithUrls {
  id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  uploadedBy: string;
  uploadedFor?: string;
  entityType: string;
  description?: string;
  tags?: string[];
  isPublic: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  fileUrl?: string;
  downloadUrl?: string;
  pngUrl?: string;
  webpUrl?: string;
  canAccess: boolean;
  canDownload: boolean;
  compressionInfo?: {
    compressed: boolean;
    originalSize: number;
    compressedSize?: number;
    savingsPercentage?: number;
    compressionType?: string;
    folderId?: string;
  };
}

export class FileService {
  private uploadDir: string;
  private compressionService: CompressionService;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.compressionService = new CompressionService();
    this.ensureUploadDirectory();

    // Start periodic cleanup of empty folders
    this.startPeriodicCleanup();
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Start periodic cleanup of empty folders
   */
  private startPeriodicCleanup(): void {
    // Clean up empty folders every 5 minutes
    setInterval(
      async () => {
        try {
          await this.compressionService.cleanupEmptyFolders();
        } catch (error) {
          console.warn('Periodic cleanup failed:', error);
        }
      },
      5 * 60 * 1000
    ); // 5 minutes
  }

  /**
   * Add URLs and access information to file data
   */
  static addFileUrl(
    file: {
      id?: string;
      _id?: string;
      originalName: string;
      filename: string;
      mimetype: string;
      size: number;
      uploadedBy: string;
      uploadedFor?: string;
      entityType: string;
      description?: string;
      tags?: string[];
      isPublic: boolean;
      expiresAt?: Date;
      createdAt: Date;
      updatedAt: Date;
      compressionInfo?: any;
    },
    userId: string,
    userRole?: string
  ): FileWithUrls {
    const fileWithUrls: FileWithUrls = {
      id: file.id || file._id || '',
      originalName: file.originalName,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      uploadedBy: file.uploadedBy,
      uploadedFor: file.uploadedFor,
      entityType: file.entityType,
      description: file.description,
      tags: file.tags,
      isPublic: file.isPublic,
      expiresAt: file.expiresAt,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      canAccess: false,
      canDownload: false,
      compressionInfo: file.compressionInfo,
    };

    // Check access permissions
    const canAccess = FileService.canAccessFile(file, userId, userRole);
    const canDownload = FileService.canDownloadFile(file, userId, userRole);

    fileWithUrls.canAccess = canAccess;
    fileWithUrls.canDownload = canDownload;

    // Add URLs only if user has access
    if (canAccess) {
      // Set default file URL (prefer WebP, fallback to PNG, then original)
      if (
        fileWithUrls.compressionInfo?.compressed &&
        fileWithUrls.compressionInfo?.compressionType === 'webp'
      ) {
        fileWithUrls.fileUrl = `${env.BASE_URL}/api/v1/files/${fileWithUrls.id}/compressed/webp`;
      } else if (
        fileWithUrls.compressionInfo?.compressed &&
        fileWithUrls.compressionInfo?.compressionType === 'png'
      ) {
        fileWithUrls.fileUrl = `${env.BASE_URL}/api/v1/files/${fileWithUrls.id}/compressed/png`;
      } else {
        fileWithUrls.fileUrl = `${env.BASE_URL}/api/v1/files/${fileWithUrls.id}/serve`;
      }

      // Add PNG and WebP URLs if compression is available
      if (fileWithUrls.compressionInfo?.compressed) {
        fileWithUrls.pngUrl = `${env.BASE_URL}/api/v1/files/${fileWithUrls.id}/compressed/png`;
        fileWithUrls.webpUrl = `${env.BASE_URL}/api/v1/files/${fileWithUrls.id}/compressed/webp`;
      }
    }

    if (canDownload) {
      fileWithUrls.downloadUrl = `${env.BASE_URL}/api/v1/files/${fileWithUrls.id}/download`;
    }

    return fileWithUrls;
  }

  /**
   * Check if user can access a file
   */
  static canAccessFile(
    file: { isPublic: boolean; uploadedBy: string },
    userId: string,
    userRole?: string
  ): boolean {
    // Public files are accessible to everyone
    if (file.isPublic) return true;

    // Private files are only accessible to uploader or admins
    return file.uploadedBy === userId || userRole === 'admin';
  }

  /**
   * Check if user can download a file
   */
  static canDownloadFile(
    file: { isPublic: boolean; uploadedBy: string },
    userId: string,
    userRole?: string
  ): boolean {
    // Public files are downloadable by everyone
    if (file.isPublic) return true;

    // Private files are only downloadable by uploader or admins
    return file.uploadedBy === userId || userRole === 'admin';
  }

  /**
   * Create a new file record with optional compression
   */
  async createFile(
    fileData: FileInput,
    enableCompression: boolean = true,
    folderInfo?: {
      folderId: string;
      folderPath: string;
      userId: string;
      tempFileId: string;
    }
  ): Promise<any> {
    try {
      const validatedData = FileSchema.parse(fileData);

      // Create file first to get the ID
      const file = new FileModel({
        ...validatedData,
        compressionInfo: {
          compressed: false,
          originalSize: validatedData.size,
        },
      });
      const savedFile = await file.save();

      // If we have folder info, rename the file with the actual file ID
      if (folderInfo && savedFile._id) {
        const actualFileId = savedFile._id.toString();
        const extension = path.extname(validatedData.filename);
        const newFilename = `${folderInfo.userId}_${actualFileId}${extension}`;
        const newPath = path.join(folderInfo.folderPath, newFilename);

        // Rename the file to use the actual file ID
        await fs.rename(validatedData.path, newPath);

        // Update the file record with the new path and filename
        await FileModel.findByIdAndUpdate(savedFile._id, {
          path: newPath,
          filename: newFilename,
        });

        // Update the validated data for compression
        validatedData.path = newPath;
        validatedData.filename = newFilename;
      }

      // Start compression asynchronously if enabled (non-blocking)
      if (enableCompression && env.ENABLE_FILE_COMPRESSION) {
        // Get existing folder path if available
        const existingFolderPath = folderInfo?.folderPath;

        // Start compression in background
        this.compressionService.compressFileAsync(
          validatedData.path,
          validatedData.mimetype,
          validatedData.size,
          validatedData.uploadedBy,
          savedFile._id.toString(),
          {
            quality: env.COMPRESSION_QUALITY,
            maxWidth: 1920,
            maxHeight: 1080,
          },
          async (compressionResult) => {
            // Update file with compression results when complete
            if (compressionResult) {
              await FileModel.findByIdAndUpdate(savedFile._id, {
                compressionInfo: {
                  compressed: true,
                  originalSize: compressionResult.originalSize,
                  compressedSize: compressionResult.compressedSize,
                  savingsPercentage: compressionResult.savingsPercentage,
                  compressionType: compressionResult.compressionType,
                  folderId: compressionResult.folderId,
                  compressionStatus: 'completed',
                },
              });
            } else {
              // Compression failed or not needed
              await FileModel.findByIdAndUpdate(savedFile._id, {
                compressionInfo: {
                  compressed: false,
                  originalSize: validatedData.size,
                  compressionStatus: 'failed',
                },
              });
            }
          },
          existingFolderPath
        );

        // Update file to indicate compression is in progress
        await FileModel.findByIdAndUpdate(savedFile._id, {
          compressionInfo: {
            compressed: false,
            originalSize: validatedData.size,
            compressionStatus: 'processing',
          },
        });
      }

      // Extract metadata automatically for images
      if (validatedData.mimetype.startsWith('image/')) {
        try {
          await savedFile.extractMetadata();
        } catch (metadataError) {
          console.warn('Failed to extract metadata:', metadataError);
          // Continue without metadata extraction
        }
      }

      // Return the updated file
      return await FileModel.findById(savedFile._id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get file by ID with access control
   */
  async getFileById(
    fileId: string,
    userId: string,
    userRole?: string
  ): Promise<FileWithUrls> {
    try {
      const file = await FileModel.findById(fileId);
      if (!file) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'File Not Found',
          MESSAGE: 'File not found',
        });
      }

      // Check if user has access
      if (!FileService.canAccessFile(file, userId, userRole)) {
        throw new APIError({
          STATUS: 401,
          TITLE: 'Access Denied',
          MESSAGE: 'You do not have permission to access this file',
        });
      }

      return FileService.addFileUrl(file, userId, userRole);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get file by filename with access control
   */
  async getFileByFilename(
    filename: string,
    userId: string,
    userRole?: string
  ): Promise<FileWithUrls> {
    try {
      const file = await FileModel.findOne({ filename });
      if (!file) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'File Not Found',
          MESSAGE: 'File not found',
        });
      }

      // Check if user has access
      if (!FileService.canAccessFile(file, userId, userRole)) {
        throw new APIError({
          STATUS: 401,
          TITLE: 'Access Denied',
          MESSAGE: 'You do not have permission to access this file',
        });
      }

      return FileService.addFileUrl(file, userId, userRole);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get files with pagination and filtering, with access control
   */
  async getFiles(
    options: FileQueryOptions = {},
    userId: string,
    userRole?: string
  ): Promise<{
    docs: FileWithUrls[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }> {
    try {
      const {
        uploadedBy,
        uploadedFor,
        entityType,
        isPublic,
        tags,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      // Build query
      const query: any = {};
      if (uploadedBy) query.uploadedBy = uploadedBy;
      if (uploadedFor) query.uploadedFor = uploadedFor;
      if (entityType) query.entityType = entityType;
      if (isPublic !== undefined) query.isPublic = isPublic;
      if (tags && tags.length > 0) {
        query.tags = { $in: tags };
      }

      // If not admin, only show public files or files uploaded by the user
      if (userRole !== 'admin') {
        query.$or = [{ isPublic: true }, { uploadedBy: userId }];
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sort: any = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [docs, total] = await Promise.all([
        FileModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
        FileModel.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      // Add URLs and access information to each file
      const filesWithUrls = docs.map((file: any) =>
        FileService.addFileUrl(file, userId, userRole)
      );

      return {
        docs: filesWithUrls,
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get files by entity with access control
   */
  async getFilesByEntity(
    entityType: string,
    entityId: string,
    userId: string,
    userRole?: string
  ): Promise<FileWithUrls[]> {
    try {
      const files = await FileModel.findByEntity(entityType, entityId);

      // Filter files based on access permissions
      const accessibleFiles = files.filter((file) =>
        FileService.canAccessFile(file, userId, userRole)
      );

      return accessibleFiles.map((file) =>
        FileService.addFileUrl(file, userId, userRole)
      );
    } catch (error) {
      throw new APIError({
        STATUS: 500,
        TITLE: 'Internal Server Error',
        MESSAGE: 'Failed to retrieve entity files',
      });
    }
  }

  /**
   * Get public files
   */
  async getPublicFiles(
    userId: string,
    userRole?: string
  ): Promise<FileWithUrls[]> {
    try {
      const files = await FileModel.findPublic();
      return files.map((file) =>
        FileService.addFileUrl(file, userId, userRole)
      );
    } catch (error) {
      throw new APIError({
        STATUS: 500,
        TITLE: 'Internal Server Error',
        MESSAGE: 'Failed to retrieve public files',
      });
    }
  }

  /**
   * Update file metadata
   */
  async updateFile(
    fileId: string,
    updateData: Partial<FileInput>,
    userId: string,
    userRole?: string
  ): Promise<FileWithUrls> {
    try {
      const file = await FileModel.findById(fileId);
      if (!file) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'File Not Found',
          MESSAGE: 'File not found',
        });
      }

      // Check if user can update this file (uploader or admin)
      if (file.uploadedBy !== userId && userRole !== 'admin') {
        throw new APIError(AUTHORIZATION_ERRORS.AUTHORIZATION_ERROR);
      }

      const updatedFile = await FileModel.findByIdAndUpdate(
        fileId,
        updateData,
        { new: true, runValidators: true }
      );

      return FileService.addFileUrl(updatedFile, userId, userRole);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(
    fileId: string,
    userId: string,
    userRole?: string
  ): Promise<void> {
    try {
      const file = await FileModel.findById(fileId);
      if (!file) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'File Not Found',
          MESSAGE: 'File not found',
        });
      }

      // Check if user can delete this file (uploader or admin)
      if (file.uploadedBy !== userId && userRole !== 'admin') {
        throw new APIError(AUTHORIZATION_ERRORS.AUTHORIZATION_ERROR);
      }

      // Delete physical file
      try {
        await fs.unlink(file.path);
      } catch (fsError) {
        // Log error but don't fail if file doesn't exist
        console.warn(`Failed to delete physical file: ${file.path}`, fsError);
      }

      // Delete database record
      await FileModel.findByIdAndDelete(fileId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clean up expired files (admin only)
   */
  async cleanupExpiredFiles(userRole?: string): Promise<number> {
    try {
      // Only admins can cleanup files
      if (userRole !== 'admin') {
        throw new APIError({
          STATUS: 401,
          TITLE: 'Access Denied',
          MESSAGE: 'Only administrators can perform file cleanup',
        });
      }

      const expiredFiles = await FileModel.findExpired();
      let deletedCount = 0;

      for (const file of expiredFiles) {
        try {
          // Delete physical file
          await fs.unlink(file.path);
          // Delete database record
          await FileModel.findByIdAndDelete(file._id);
          deletedCount++;
        } catch (error) {
          console.error(
            `Failed to cleanup expired file: ${file.filename}`,
            error
          );
        }
      }

      return deletedCount;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get file statistics (admin only or filtered for user)
   */
  async getFileStatistics(
    userId: string,
    userRole?: string
  ): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
    filesByEntity: Record<string, number>;
    publicFiles: number;
    privateFiles: number;
    userFiles: number;
    compressionStats: {
      compressedFiles: number;
      totalSavings: number;
      averageSavingsPercentage: number;
    };
  }> {
    try {
      let query = {};

      // If not admin, only show user's files and public files
      if (userRole !== 'admin') {
        query = {
          $or: [{ isPublic: true }, { uploadedBy: userId }],
        };
      }

      const [
        totalFiles,
        totalSizeResult,
        filesByType,
        filesByEntity,
        publicFiles,
        userFiles,
        compressionStats,
      ] = await Promise.all([
        FileModel.countDocuments(query),
        FileModel.aggregate([
          { $match: query },
          { $group: { _id: null, totalSize: { $sum: '$size' } } },
        ]),
        FileModel.aggregate([
          { $match: query },
          { $group: { _id: '$mimetype', count: { $sum: 1 } } },
        ]),
        FileModel.aggregate([
          { $match: query },
          { $group: { _id: '$entityType', count: { $sum: 1 } } },
        ]),
        FileModel.countDocuments({ ...query, isPublic: true }),
        FileModel.countDocuments({ ...query, uploadedBy: userId }),
        FileModel.aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              compressedFiles: {
                $sum: { $cond: ['$compressionInfo.compressed', 1, 0] },
              },
              totalSavings: {
                $sum: {
                  $cond: [
                    '$compressionInfo.compressed',
                    {
                      $subtract: [
                        '$compressionInfo.originalSize',
                        '$compressionInfo.compressedSize',
                      ],
                    },
                    0,
                  ],
                },
              },
              averageSavingsPercentage: {
                $avg: {
                  $cond: [
                    '$compressionInfo.compressed',
                    '$compressionInfo.savingsPercentage',
                    null,
                  ],
                },
              },
            },
          },
        ]),
      ]);

      const totalSize = totalSizeResult[0]?.totalSize || 0;
      const privateFiles = totalFiles - publicFiles;
      const compressionData = compressionStats[0] || {
        compressedFiles: 0,
        totalSavings: 0,
        averageSavingsPercentage: 0,
      };

      return {
        totalFiles,
        totalSize,
        filesByType: filesByType.reduce(
          (acc, item) => {
            acc[item._id] = item.count;
            return acc;
          },
          {} as Record<string, number>
        ),
        filesByEntity: filesByEntity.reduce(
          (acc, item) => {
            acc[item._id] = item.count;
            return acc;
          },
          {} as Record<string, number>
        ),
        publicFiles,
        privateFiles,
        userFiles,
        compressionStats: {
          compressedFiles: compressionData.compressedFiles,
          totalSavings: compressionData.totalSavings,
          averageSavingsPercentage:
            Math.round((compressionData.averageSavingsPercentage || 0) * 100) /
            100,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate file access permissions
   */
  async validateFileAccess(
    fileId: string,
    userId: string,
    userRole?: string
  ): Promise<boolean> {
    try {
      const file = await FileModel.findById(fileId);
      if (!file) return false;
      return FileService.canAccessFile(file, userId, userRole);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate file download permissions
   */
  async validateFileDownload(
    fileId: string,
    userId: string,
    userRole?: string
  ): Promise<boolean> {
    try {
      const file = await FileModel.findById(fileId);
      if (!file) return false;

      return FileService.canDownloadFile(file, userId, userRole);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file path for serving (internal use only)
   */
  getFilePath(filename: string): string {
    return path.join(this.uploadDir, filename);
  }

  /**
   * Check if file exists on disk
   */
  async fileExistsOnDisk(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Compress multiple files into a ZIP archive
   */
  async compressFiles(
    fileIds: string[],
    userId: string,
    userRole?: string,
    archiveName?: string
  ): Promise<{
    archivePath: string;
    archiveSize: number;
    fileCount: number;
  }> {
    try {
      // Validate access to all files
      for (const fileId of fileIds) {
        const hasAccess = await this.validateFileAccess(
          fileId,
          userId,
          userRole
        );
        if (!hasAccess) {
          throw new APIError({
            STATUS: 401,
            TITLE: 'Access Denied',
            MESSAGE: `No access to file ${fileId}`,
          });
        }
      }

      // Get file records
      const files = await Promise.all(
        fileIds.map((id) => FileModel.findById(id))
      );

      // Create archive
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Maximum compression
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archiveFilename = archiveName || `archive_${timestamp}.zip`;
      const archivePath = path.join(this.uploadDir, archiveFilename);

      const output = createWriteStream(archivePath);

      return new Promise((resolve, reject) => {
        output.on('close', async () => {
          try {
            const stats = await fs.stat(archivePath);
            resolve({
              archivePath,
              archiveSize: stats.size,
              fileCount: files.length,
            });
          } catch (error) {
            reject(error);
          }
        });

        archive.on('error', (err) => {
          reject(err);
        });

        archive.pipe(output);

        // Add files to archive
        files.forEach((file) => {
          const filePath = this.getFilePath(file.filename);
          archive.file(filePath, { name: file.originalName });
        });

        archive.finalize();
      });
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError({
        STATUS: 500,
        TITLE: 'Compression Error',
        MESSAGE: 'Failed to compress files',
      });
    }
  }

  /**
   * Create a compressed archive of files by entity
   */
  async compressEntityFiles(
    entityType: string,
    entityId: string,
    userId: string,
    userRole?: string
  ): Promise<{
    archivePath: string;
    archiveSize: number;
    fileCount: number;
  }> {
    try {
      const files = await this.getFilesByEntity(
        entityType,
        entityId,
        userId,
        userRole
      );

      if (files.length === 0) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'No Files Found',
          MESSAGE: 'No files found for this entity',
        });
      }

      const fileIds = files.map((file) => file.id);
      const archiveName = `${entityType}_${entityId}_${new Date().toISOString().split('T')[0]}.zip`;

      return await this.compressFiles(fileIds, userId, userRole, archiveName);
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError({
        STATUS: 500,
        TITLE: 'Compression Error',
        MESSAGE: 'Failed to compress entity files',
      });
    }
  }

  /**
   * Get file compression statistics
   */
  async getCompressionStats(
    fileIds: string[],
    userId: string,
    userRole?: string
  ): Promise<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    savingsPercentage: number;
  }> {
    try {
      // Validate access to all files
      for (const fileId of fileIds) {
        const hasAccess = await this.validateFileAccess(
          fileId,
          userId,
          userRole
        );
        if (!hasAccess) {
          throw new APIError({
            STATUS: 401,
            TITLE: 'Access Denied',
            MESSAGE: `No access to file ${fileId}`,
          });
        }
      }

      const files = await Promise.all(
        fileIds.map((id) => FileModel.findById(id))
      );

      const originalSize = files.reduce((sum, file) => sum + file.size, 0);

      // For ZIP compression, estimate ~20% compression ratio for mixed content
      const estimatedCompressionRatio = 0.8;
      const compressedSize = Math.round(
        originalSize * estimatedCompressionRatio
      );
      const savingsPercentage =
        ((originalSize - compressedSize) / originalSize) * 100;

      return {
        originalSize,
        compressedSize,
        compressionRatio: estimatedCompressionRatio,
        savingsPercentage: Math.round(savingsPercentage * 100) / 100,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError({
        STATUS: 500,
        TITLE: 'Compression Error',
        MESSAGE: 'Failed to calculate compression statistics',
      });
    }
  }

  /**
   * Extract metadata from uploaded file
   */
  async extractFileMetadata(
    fileId: string,
    userId: string,
    userRole?: string
  ): Promise<any> {
    try {
      const file = await FileModel.findById(fileId);
      if (!file) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'File not found',
          MESSAGE: 'File not found',
        });
      }

      // Check access permissions
      if (!FileService.canAccessFile(file, userId, userRole)) {
        throw new APIError({
          STATUS: 401,
          TITLE: 'Access Denied',
          MESSAGE: 'You do not have permission to access this file',
        });
      }

      // Extract metadata
      await file.extractMetadata();

      return file.metadata;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add location metadata to file
   */
  async addLocationMetadata(
    fileId: string,
    latitude: number,
    longitude: number,
    userId: string,
    options?: {
      altitude?: number;
      accuracy?: number;
      address?: string;
      city?: string;
      country?: string;
    },
    userRole?: string
  ): Promise<any> {
    try {
      const file = await FileModel.findById(fileId);
      if (!file) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'File not found',
          MESSAGE: 'File not found',
        });
      }

      // Check access permissions
      if (!FileService.canAccessFile(file, userId, userRole)) {
        throw new APIError({
          STATUS: 401,
          TITLE: 'Access Denied',
          MESSAGE: 'You do not have permission to access this file',
        });
      }

      // Add location metadata
      file.addLocationMetadata(latitude, longitude, options);
      await file.save();

      return file.metadata;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add custom metadata to file
   */
  async addCustomMetadata(
    fileId: string,
    key: string,
    value: any,
    userId: string,
    userRole?: string
  ): Promise<any> {
    try {
      const file = await FileModel.findById(fileId);
      if (!file) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'File not found',
          MESSAGE: 'File not found',
        });
      }

      // Check access permissions
      if (!FileService.canAccessFile(file, userId, userRole)) {
        throw new APIError({
          STATUS: 401,
          TITLE: 'Access Denied',
          MESSAGE: 'You do not have permission to access this file',
        });
      }

      // Add custom metadata
      file.addCustomMetadata(key, value);
      await file.save();

      return file.metadata;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search files by location (within radius)
   */
  async searchFilesByLocation(
    latitude: number,
    longitude: number,
    radius: number, // in kilometers
    options: FileQueryOptions = {},
    userId: string,
    userRole?: string
  ): Promise<{
    docs: FileWithUrls[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }> {
    try {
      // Convert radius from km to degrees (approximate)
      const radiusInDegrees = radius / 111.32; // 1 degree ≈ 111.32 km

      const query: any = {
        'metadata.location.latitude': {
          $gte: latitude - radiusInDegrees,
          $lte: latitude + radiusInDegrees,
        },
        'metadata.location.longitude': {
          $gte: longitude - radiusInDegrees,
          $lte: longitude + radiusInDegrees,
        },
      };

      // Add other filters
      if (options.uploadedBy) query.uploadedBy = options.uploadedBy;
      if (options.uploadedFor) query.uploadedFor = options.uploadedFor;
      if (options.entityType) query.entityType = options.entityType;
      if (options.isPublic !== undefined) query.isPublic = options.isPublic;
      if (options.tags && options.tags.length > 0) {
        query.tags = { $in: options.tags };
      }

      // If not admin, only show public files or files uploaded by the user
      if (userRole !== 'admin') {
        query.$or = [{ isPublic: true }, { uploadedBy: userId }];
      }

      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      const [docs, total] = await Promise.all([
        FileModel.find(query).skip(skip).limit(limit).lean(),
        FileModel.countDocuments(query),
      ]);

      // Add URLs and access information
      const filesWithUrls = docs.map((file: any) =>
        FileService.addFileUrl(file, userId, userRole)
      );

      return {
        docs: filesWithUrls,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get files with specific metadata
   */
  async getFilesWithMetadata(
    options: FileQueryOptions = {},
    userId: string,
    userRole?: string
  ): Promise<{
    docs: FileWithUrls[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }> {
    try {
      const query: any = {};

      // Add metadata filters
      if (options.hasLocation) {
        query['metadata.location'] = { $exists: true, $ne: null };
      }
      if (options.hasImageMetadata) {
        query['metadata.image'] = { $exists: true, $ne: null };
      }
      if (options.deviceMake) {
        query['metadata.device.make'] = options.deviceMake;
      }
      if (options.deviceModel) {
        query['metadata.device.model'] = options.deviceModel;
      }

      // Add other filters
      if (options.uploadedBy) query.uploadedBy = options.uploadedBy;
      if (options.uploadedFor) query.uploadedFor = options.uploadedFor;
      if (options.entityType) query.entityType = options.entityType;
      if (options.isPublic !== undefined) query.isPublic = options.isPublic;
      if (options.tags && options.tags.length > 0) {
        query.tags = { $in: options.tags };
      }

      // If not admin, only show public files or files uploaded by the user
      if (userRole !== 'admin') {
        query.$or = [{ isPublic: true }, { uploadedBy: userId }];
      }

      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      const [docs, total] = await Promise.all([
        FileModel.find(query).skip(skip).limit(limit).lean(),
        FileModel.countDocuments(query),
      ]);

      // Add URLs and access information
      const filesWithUrls = docs.map((file: any) =>
        FileService.addFileUrl(file, userId, userRole)
      );

      return {
        docs: filesWithUrls,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };
    } catch (error) {
      throw error;
    }
  }
}
