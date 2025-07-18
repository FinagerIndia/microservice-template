import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import env from '@/configs/env';

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  savingsPercentage: number;
  compressionType: 'png' | 'webp' | 'both' | 'none';
  compressedPaths?: {
    png?: string;
    webp?: string;
  };
  folderId: string;
}

export interface CompressionOptions {
  quality?: number;
  thresholdSize?: number;
  compressImages?: boolean;
  compressPdfs?: boolean;
  compressText?: boolean;
  maxWidth?: number;
  maxHeight?: number;
}

export class CompressionService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
  }

  /**
   * Check if file should be compressed based on type and size
   */
  private shouldCompressFile(
    mimetype: string,
    size: number,
    options: CompressionOptions = {}
  ): boolean {
    const {
      thresholdSize = env.COMPRESSION_THRESHOLD_SIZE,
      compressImages = env.COMPRESS_IMAGE_TYPES,
      compressPdfs = env.COMPRESS_PDF_TYPES,
      compressText = env.COMPRESS_TEXT_TYPES,
    } = options;

    // For images, always compress regardless of size
    if (compressImages && this.isImageType(mimetype)) {
      return true;
    }

    // Don't compress if file is too small (for non-images)
    if (size < thresholdSize) {
      return false;
    }

    if (compressPdfs && this.isPdfType(mimetype)) {
      return true;
    }

    if (compressText && this.isTextType(mimetype)) {
      return true;
    }

    return false;
  }

  /**
   * Check if mimetype is an image
   */
  private isImageType(mimetype: string): boolean {
    return mimetype.startsWith('image/');
  }

  /**
   * Check if mimetype is a PDF
   */
  private isPdfType(mimetype: string): boolean {
    return mimetype === 'application/pdf';
  }

  /**
   * Check if mimetype is text-based
   */
  private isTextType(mimetype: string): boolean {
    return (
      mimetype.startsWith('text/') ||
      mimetype.includes('json') ||
      mimetype.includes('xml') ||
      mimetype.includes('csv') ||
      mimetype.includes('javascript') ||
      mimetype.includes('css') ||
      mimetype.includes('html')
    );
  }

  /**
   * Create folder structure for file
   */
  private async createFileFolder(folderId: string): Promise<string> {
    const folderPath = path.join(this.uploadDir, folderId);
    await fs.mkdir(folderPath, { recursive: true });
    return folderPath;
  }

  /**
   * Generate filename with user and file ID
   */
  private generateFilename(
    userId: string,
    fileId: string,
    extension: string
  ): string {
    return `${userId}_${fileId}.${extension}`;
  }

  /**
   * Compress image using Sharp (optimized for speed)
   */
  private async compressImage(
    filePath: string,
    folderPath: string,
    userId: string,
    fileId: string,
    originalSize: number,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const {
      quality = env.COMPRESSION_QUALITY,
      maxWidth = 1920,
      maxHeight = 1080,
    } = options;

    const originalExt = path.extname(filePath).toLowerCase();
    const baseName = path.parse(filePath).name;

    // Generate filenames
    const compressedPngName = this.generateFilename(userId, fileId, 'png');
    const webpName = this.generateFilename(userId, fileId, 'webp');

    const compressedPngPath = path.join(folderPath, compressedPngName);
    const webpPath = path.join(folderPath, webpName);

    try {
      // Load image with Sharp and process both formats in parallel
      const image = sharp(filePath);
      const metadata = await image.metadata();

      // Resize if needed
      if (metadata.width && metadata.height) {
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
          image.resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }
      }

      // Process both formats in parallel for better performance
      const [compressedPngBuffer, webpBuffer] = await Promise.all([
        image
          .png({
            quality: quality,
            compressionLevel: 9,
            progressive: true,
          })
          .toBuffer(),
        sharp(filePath)
          .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({
            quality: quality,
            effort: 6,
          })
          .toBuffer(),
      ]);

      // Write files in parallel
      await Promise.all([
        fs.writeFile(compressedPngPath, compressedPngBuffer),
        fs.writeFile(webpPath, webpBuffer),
      ]);

      // Delete original file after successful compression
      try {
        await fs.unlink(filePath);

        // Check if folder is empty and delete it
        const folderContents = await fs.readdir(folderPath);
        if (folderContents.length === 0) {
          await fs.rmdir(folderPath);
        }
      } catch (error) {
        // Log but don't throw - compression was successful
        console.warn(`⚠️  Failed to cleanup original file: ${error}`);
      }

      const compressedPngSize = compressedPngBuffer.length;
      const webpSize = webpBuffer.length;

      // Choose the best compression result
      const pngRatio = compressedPngSize / originalSize;
      const webpRatio = webpSize / originalSize;

      let compressionType: 'png' | 'webp' | 'both' | 'none';
      let compressedSize: number;
      let compressionRatio: number;

      if (webpRatio < pngRatio && webpRatio < 0.95) {
        compressionType = 'webp';
        compressedSize = webpSize;
        compressionRatio = webpRatio;
      } else if (pngRatio < 0.95) {
        compressionType = 'png';
        compressedSize = compressedPngSize;
        compressionRatio = pngRatio;
      } else {
        compressionType = 'both';
        compressedSize = Math.min(compressedPngSize, webpSize);
        compressionRatio = compressedSize / originalSize;
      }

      const savingsPercentage =
        ((originalSize - compressedSize) / originalSize) * 100;

      return {
        originalSize,
        compressedSize,
        compressionRatio,
        savingsPercentage,
        compressionType,
        compressedPaths: {
          png: compressedPngPath,
          webp: webpPath,
        },
        folderId: path.basename(folderPath),
      };
    } catch (error) {
      console.error('Image compression failed:', error);
      throw new Error(`Image compression failed: ${error}`);
    }
  }

  /**
   * Compress text-based files (legacy method)
   */
  private async compressTextFile(
    filePath: string,
    originalSize: number
  ): Promise<CompressionResult> {
    // This is kept for backward compatibility but not recommended for images
    const filename = path.basename(filePath);
    const nameWithoutExt = path.parse(filename).name;
    const ext = path.parse(filename).ext;

    const gzipPath = path.join(this.uploadDir, `${nameWithoutExt}${ext}.gz`);

    try {
      const fileBuffer = await fs.readFile(filePath);
      const { gzipSync } = await import('zlib');
      const compressedBuffer = gzipSync(fileBuffer, { level: 6 });
      await fs.writeFile(gzipPath, compressedBuffer);

      const compressedSize = compressedBuffer.length;
      const compressionRatio = compressedSize / originalSize;
      const savingsPercentage =
        ((originalSize - compressedSize) / originalSize) * 100;

      return {
        originalSize,
        compressedSize,
        compressionRatio,
        savingsPercentage,
        compressionType: 'none',
        folderId: '',
      };
    } catch (error) {
      throw new Error(`Text compression failed: ${error}`);
    }
  }

  /**
   * Compress a file during upload (asynchronous - returns immediately)
   */
  async compressFile(
    filePath: string,
    mimetype: string,
    originalSize: number,
    userId: string,
    fileId: string,
    options: CompressionOptions = {},
    existingFolderPath?: string
  ): Promise<CompressionResult | null> {
    try {
      // Check if compression is enabled globally
      if (!env.ENABLE_FILE_COMPRESSION) {
        return null;
      }

      // Check if this file should be compressed
      if (!this.shouldCompressFile(mimetype, originalSize, options)) {
        return null;
      }

      // Handle images with Sharp
      if (this.isImageType(mimetype)) {
        let folderPath: string;
        let folderId: string;

        if (existingFolderPath) {
          // Use existing folder from organizeUploadedFile
          folderPath = existingFolderPath;
          folderId = path.basename(existingFolderPath);
        } else {
          // Create new folder (fallback)
          folderId = uuidv4();
          folderPath = await this.createFileFolder(folderId);
        }

        const result = await this.compressImage(
          filePath,
          folderPath,
          userId,
          fileId,
          originalSize,
          options
        );

        return result;
      }

      // Handle other file types (legacy)
      if (this.isTextType(mimetype)) {
        const result = await this.compressTextFile(filePath, originalSize);
        return result;
      }

      return null;
    } catch (error) {
      console.error('Compression failed:', error);
      return null;
    }
  }

  /**
   * Compress file asynchronously (non-blocking)
   */
  compressFileAsync(
    filePath: string,
    mimetype: string,
    originalSize: number,
    userId: string,
    fileId: string,
    options: CompressionOptions = {},
    onComplete?: (result: CompressionResult | null) => void,
    existingFolderPath?: string
  ): void {
    // Start compression in background without waiting
    this.compressFile(
      filePath,
      mimetype,
      originalSize,
      userId,
      fileId,
      options,
      existingFolderPath
    )
      .then((result) => {
        if (result) {
          console.log(`✅ Background compression completed for ${fileId}`);
          if (onComplete) {
            onComplete(result);
          }
        }
      })
      .catch((error) => {
        console.error(`❌ Background compression failed for ${fileId}:`, error);
        if (onComplete) {
          onComplete(null);
        }
      });
  }

  /**
   * Get compression statistics for multiple files
   */
  async getCompressionStats(fileIds: string[]): Promise<{
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageCompressionRatio: number;
    totalSavingsPercentage: number;
    compressedFiles: number;
    totalFiles: number;
  }> {
    // This would need to be implemented with actual file data
    // For now, return estimated statistics
    const totalFiles = fileIds.length;
    const estimatedCompressionRatio = 0.7; // 30% reduction on average
    const totalOriginalSize = 1000000 * totalFiles; // Mock size
    const totalCompressedSize = totalOriginalSize * estimatedCompressionRatio;
    const totalSavingsPercentage = (1 - estimatedCompressionRatio) * 100;

    return {
      totalOriginalSize,
      totalCompressedSize,
      averageCompressionRatio: estimatedCompressionRatio,
      totalSavingsPercentage,
      compressedFiles: Math.floor(totalFiles * 0.8), // Assume 80% of files are compressed
      totalFiles,
    };
  }

  /**
   * Clean up compressed files
   */
  async cleanupCompressedFiles(compressedPaths: string[]): Promise<void> {
    for (const compressedPath of compressedPaths) {
      try {
        await fs.unlink(compressedPath);
        console.log(`Cleaned up compressed file: ${compressedPath}`);
      } catch (error) {
        console.warn(
          `Failed to cleanup compressed file: ${compressedPath}`,
          error
        );
      }
    }
  }

  /**
   * Get file path for a specific version
   */
  getFilePath(folderId: string, filename: string): string {
    return path.join(this.uploadDir, folderId, filename);
  }

  /**
   * Check if compressed file exists
   */
  async compressedFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up empty folders in uploads directory
   */
  async cleanupEmptyFolders(): Promise<void> {
    try {
      const folders = await fs.readdir(this.uploadDir, { withFileTypes: true });

      for (const folder of folders) {
        if (folder.isDirectory()) {
          const folderPath = path.join(this.uploadDir, folder.name);
          const contents = await fs.readdir(folderPath);

          if (contents.length === 0) {
            await fs.rmdir(folderPath);
            console.log(`🧹 Cleaned up empty folder: ${folder.name}`);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup empty folders:', error);
    }
  }
}
