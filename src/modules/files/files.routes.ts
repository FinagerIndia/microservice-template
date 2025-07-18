import { Router, Request, Response } from 'express';
import path from 'path';
import { FileService } from './files.service';
import {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
  logFormData,
  organizeUploadedFile,
} from '../../middlewares/fileUpload';
import Respond from '../../lib/respond';
import APIError from '../../lib/errors/APIError';
import logger from '@/configs/logger';
import { FileInput } from './files.model';

const router = Router();
const fileService = new FileService();

// Upload single file
router.post(
  '/upload',
  uploadSingle,
  handleUploadError,
  organizeUploadedFile,
  logFormData,
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'No File Uploaded',
          MESSAGE: 'Please select a file to upload',
        });
      }

      const fileData: FileInput = {
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        uploadedBy: req.user!.id,
        uploadedFor: req.body.uploadedFor,
        entityType: req.body.entityType || 'other',
        description: req.body.description,
        metadata:
          req.body.latitude && req.body.longitude
            ? {
                location: {
                  latitude: parseFloat(req.body.latitude),
                  longitude: parseFloat(req.body.longitude),
                  altitude: req.body.altitude
                    ? parseFloat(req.body.altitude)
                    : undefined,
                  accuracy: req.body.accuracy
                    ? parseFloat(req.body.accuracy)
                    : undefined,
                  address: req.body.address,
                  city: req.body.city,
                  country: req.body.country,
                },
              }
            : undefined,
        tags: req.body.tags
          ? req.body.tags.split(',').map((tag: string) => tag.trim())
          : [],
        isPublic: req.body.isPublic === 'true',
        expiresAt: req.body.expiresAt
          ? new Date(req.body.expiresAt)
          : undefined,
      };

      // Enable compression by default, but allow override
      const enableCompression = req.body.enableCompression !== 'false';
      logger.info(
        `enableCompression: ${enableCompression},`,
        req.body.enableCompression
      );

      // Get folder info from request if available
      const folderInfo = (req as any).fileFolderInfo;

      const file = await fileService.createFile(
        fileData,
        enableCompression,
        folderInfo
      );
      const fileWithUrls = FileService.addFileUrl(
        file,
        req.user!.id,
        req.user!.role
      );

      Respond(
        res,
        {
          message: 'File uploaded successfully',
          data: fileWithUrls,
        },
        200
      );
    } catch (error) {
      throw error;
    }
  }
);

// Upload multiple files
router.post(
  '/upload-multiple',
  uploadMultiple,
  handleUploadError,
  organizeUploadedFile,
  logFormData,
  async (req: Request, res: Response) => {
    try {
      if (!req.files || req.files.length === 0) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'No Files Uploaded',
          MESSAGE: 'Please select files to upload',
        });
      }

      const uploadedFiles = [];
      const enableCompression = req.body.enableCompression !== 'false';
      const folderInfo = (req as any).fileFolderInfo;

      for (const file of req.files as Express.Multer.File[]) {
        const fileData = {
          originalName: file.originalname,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          path: file.path,
          uploadedBy: req.user!.id,
          uploadedFor: req.body.uploadedFor,
          entityType: req.body.entityType || 'other',
          description: req.body.description,
          metadata:
            req.body.latitude && req.body.longitude
              ? {
                  location: {
                    latitude: parseFloat(req.body.latitude),
                    longitude: parseFloat(req.body.longitude),
                    altitude: req.body.altitude
                      ? parseFloat(req.body.altitude)
                      : undefined,
                    accuracy: req.body.accuracy
                      ? parseFloat(req.body.accuracy)
                      : undefined,
                    address: req.body.address,
                    city: req.body.city,
                    country: req.body.country,
                  },
                }
              : undefined,
          tags: req.body.tags
            ? req.body.tags.split(',').map((tag: string) => tag.trim())
            : [],
          isPublic: req.body.isPublic === 'true',
          expiresAt: req.body.expiresAt
            ? new Date(req.body.expiresAt)
            : undefined,
        };

        const savedFile = await fileService.createFile(
          fileData,
          enableCompression,
          folderInfo
        );
        const fileWithUrls = FileService.addFileUrl(
          savedFile,
          req.user!.id,
          'admin'
        );
        uploadedFiles.push(fileWithUrls);
      }

      Respond(
        res,
        {
          message: `${uploadedFiles.length} files uploaded successfully`,
          data: uploadedFiles,
        },
        200
      );
    } catch (error) {
      throw error;
    }
  }
);

// Get all files with pagination and filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      uploadedBy,
      uploadedFor,
      entityType,
      isPublic,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const options = {
      uploadedBy: uploadedBy as string,
      uploadedFor: uploadedFor as string,
      entityType: entityType as string,
      isPublic: isPublic === 'true',
      tags: tags
        ? (tags as string).split(',').map((tag) => tag.trim())
        : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const files = await fileService.getFiles(options, req.user!.id, userRole);

    Respond(
      res,
      {
        message: 'Files fetched successfully',
        data: files,
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

// Get file by ID
router.get('/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const file = await fileService.getFileById(fileId, req.user!.id, userRole);

    Respond(
      res,
      {
        message: 'File fetched successfully',
        data: file,
      },
      200
    );
  } catch (error) {
    if (error instanceof APIError) {
      Respond(res, error.serializeError(), error.statusCode);
    } else {
      Respond(
        res,
        {
          message: 'Failed to fetch file',
        },
        500
      );
    }
  }
});

// Download file
router.get('/:fileId/download', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    // Check if user has download access
    const hasDownloadAccess = await fileService.validateFileDownload(
      fileId,
      req.user!.id,
      userRole
    );

    if (!hasDownloadAccess) {
      throw new APIError({
        STATUS: 401,
        TITLE: 'Access Denied',
        MESSAGE: 'You do not have permission to download this file',
      });
    }

    // Get file record (without URLs since we're downloading)
    const file = await fileService.getFileById(fileId, req.user!.id, userRole);

    // Check if file exists on disk
    let filePath: string;

    // If file has compression info, use the compressed version path
    if (file.compressionInfo?.compressed && file.compressionInfo?.folderId) {
      // For compressed files, we need to construct the path using folder ID
      const folderPath = path.join(
        process.cwd(),
        'uploads',
        file.compressionInfo.folderId
      );
      filePath = path.join(folderPath, file.filename);
    } else {
      // For uncompressed files, use the original path
      filePath = fileService.getFilePath(file.filename);
    }

    const exists = await fileService.fileExistsOnDisk(filePath);

    if (!exists) {
      throw new APIError({
        STATUS: 404,
        TITLE: 'File Not Found',
        MESSAGE: 'File not found on disk',
      });
    }

    // Set headers for download
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.originalName}"`
    );
    res.setHeader('Content-Length', file.size);

    // Send file
    res.sendFile(filePath);
  } catch (error) {
    throw error;
  }
});

// Serve file (for viewing in browser)
router.get('/:fileId/serve', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    // Check if user has access
    const hasAccess = await fileService.validateFileAccess(
      fileId,
      req.user!.id,
      userRole
    );

    if (!hasAccess) {
      throw new APIError({
        STATUS: 401,
        TITLE: 'Access Denied',
        MESSAGE: 'You do not have permission to view this file',
      });
    }

    // Get file record (without URLs since we're serving)
    const file = await fileService.getFileById(fileId, req.user!.id, userRole);

    // Check if file exists on disk
    let filePath: string;

    // If file has compression info, use the compressed version path
    if (file.compressionInfo?.compressed && file.compressionInfo?.folderId) {
      // For compressed files, we need to construct the path using folder ID
      const folderPath = path.join(
        process.cwd(),
        'uploads',
        file.compressionInfo.folderId
      );
      filePath = path.join(folderPath, file.filename);
    } else {
      // For uncompressed files, use the original path
      filePath = fileService.getFilePath(file.filename);
    }

    const exists = await fileService.fileExistsOnDisk(filePath);

    if (!exists) {
      throw new APIError({
        STATUS: 404,
        TITLE: 'File Not Found',
        MESSAGE: 'File not found on disk',
      });
    }

    // Set headers for viewing
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Length', file.size);

    // Send file
    res.sendFile(filePath);
  } catch (error) {
    throw error;
  }
});

// Serve compressed version of file
router.get(
  '/:fileId/compressed/:format',
  async (req: Request, res: Response) => {
    try {
      const { fileId, format } = req.params;

      // Get user role from request (you may need to adjust this based on your auth setup)
      const userRole = (req.user as any)?.role || 'user';
      // Check if user has access
      const hasAccess = await fileService.validateFileAccess(
        fileId,
        req.user!.id,
        userRole
      );

      if (!hasAccess) {
        throw new APIError({
          STATUS: 401,
          TITLE: 'Access Denied',
          MESSAGE: 'You do not have permission to view this file',
        });
      }

      // Get file record
      const file = await fileService.getFileById(
        fileId,
        req.user!.id,
        userRole
      );

      // Check if file has compression info
      if (
        !file.compressionInfo?.compressed ||
        !file.compressionInfo?.folderId
      ) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Compressed Version Not Available',
          MESSAGE: 'This file does not have a compressed version available',
        });
      }

      // Determine which compressed file to serve
      let compressedFilePath: string;
      let contentType: string;

      if (format === 'png') {
        // Construct PNG path using folder ID and filename
        const folderPath = path.join(
          process.cwd(),
          'uploads',
          file.compressionInfo.folderId
        );
        const pngFilename = file.filename.replace(/\.[^/.]+$/, '.png'); // Replace extension with .png
        compressedFilePath = path.join(folderPath, pngFilename);
        contentType = 'image/png';
      } else if (format === 'webp') {
        // Construct WebP path using folder ID and filename
        const folderPath = path.join(
          process.cwd(),
          'uploads',
          file.compressionInfo.folderId
        );
        const webpFilename = file.filename.replace(/\.[^/.]+$/, '.webp'); // Replace extension with .webp
        compressedFilePath = path.join(folderPath, webpFilename);
        contentType = 'image/webp';
      } else {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Format Not Available',
          MESSAGE: `Compressed ${format} version not available for this file`,
        });
      }

      // Check if compressed file exists
      const exists = await fileService.fileExistsOnDisk(compressedFilePath);
      if (!exists) {
        throw new APIError({
          STATUS: 404,
          TITLE: 'Compressed File Not Found',
          MESSAGE: 'Compressed file not found on disk',
        });
      }

      // Get file stats for content length
      const fs = await import('fs/promises');
      const stats = await fs.stat(compressedFilePath);

      // Set headers for viewing
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('X-Compression-Type', format);
      res.setHeader('X-Original-Size', file.compressionInfo.originalSize);
      res.setHeader('X-Compressed-Size', stats.size);

      // Send compressed file
      res.sendFile(compressedFilePath);
    } catch (error) {
      throw error;
    }
  }
);

// Get files by entity
router.get(
  '/entity/:entityType/:entityId',
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;

      // Get user role from request (you may need to adjust this based on your auth setup)
      const userRole = (req.user as any)?.role || 'user';

      const files = await fileService.getFilesByEntity(
        entityType,
        entityId,
        req.user!.id,
        userRole
      );

      Respond(
        res,
        {
          message: 'Entity files fetched successfully',
          data: files,
        },
        200
      );
    } catch (error) {
      throw error;
    }
  }
);

// Get public files
router.get('/public/list', async (req: Request, res: Response) => {
  try {
    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const files = await fileService.getPublicFiles(req.user!.id, userRole);

    Respond(
      res,
      {
        message: 'Public files fetched successfully',
        data: files,
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

// Update file metadata
router.put('/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const updateData = {
      description: req.body.description,
      tags: req.body.tags
        ? req.body.tags.split(',').map((tag: string) => tag.trim())
        : undefined,
      isPublic:
        req.body.isPublic !== undefined
          ? req.body.isPublic === 'true'
          : undefined,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
    };

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const updatedFile = await fileService.updateFile(
      fileId,
      updateData,
      req.user!.id,
      userRole
    );

    Respond(
      res,
      {
        message: 'File updated successfully',
        data: updatedFile,
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

// Delete file
router.delete('/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    await fileService.deleteFile(fileId, req.user!.id, userRole);

    Respond(
      res,
      {
        message: 'File deleted successfully',
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

// Get file statistics
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const stats = await fileService.getFileStatistics(req.user!.id, userRole);

    Respond(
      res,
      {
        message: 'File statistics fetched successfully',
        data: stats,
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

// Cleanup expired files (admin only)
router.post('/cleanup/expired', async (req: Request, res: Response) => {
  try {
    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const deletedCount = await fileService.cleanupExpiredFiles(userRole);

    Respond(
      res,
      {
        message: `Cleanup completed. ${deletedCount} expired files deleted.`,
        data: { deletedCount },
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

// Compress multiple files into ZIP archive
router.post('/compress', async (req: Request, res: Response) => {
  try {
    const { fileIds, archiveName } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new APIError({
        STATUS: 400,
        TITLE: 'Invalid Request',
        MESSAGE: 'fileIds array is required and must not be empty',
      });
    }

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const result = await fileService.compressFiles(
      fileIds,
      req.user!.id,
      userRole,
      archiveName
    );

    Respond(
      res,
      {
        message: `Successfully compressed ${result.fileCount} files`,
        data: result,
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

// Compress files by entity
router.post(
  '/compress/entity/:entityType/:entityId',
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;

      // Get user role from request (you may need to adjust this based on your auth setup)
      const userRole = (req.user as any)?.role || 'user';

      const result = await fileService.compressEntityFiles(
        entityType,
        entityId,
        req.user!.id,
        userRole
      );

      Respond(
        res,
        {
          message: `Successfully compressed ${result.fileCount} files for ${entityType}`,
          data: result,
        },
        200
      );
    } catch (error) {
      throw error;
    }
  }
);

// Get compression statistics
router.post('/compress/stats', async (req: Request, res: Response) => {
  try {
    const { fileIds } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new APIError({
        STATUS: 400,
        TITLE: 'Invalid Request',
        MESSAGE: 'fileIds array is required and must not be empty',
      });
    }

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const stats = await fileService.getCompressionStats(
      fileIds,
      req.user!.id,
      userRole
    );

    Respond(
      res,
      {
        message: 'Compression statistics calculated',
        data: stats,
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

// Extract metadata from file
router.post(
  '/:fileId/metadata/extract',
  async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;

      // Get user role from request (you may need to adjust this based on your auth setup)
      const userRole = (req.user as any)?.role || 'user';

      const metadata = await fileService.extractFileMetadata(
        fileId,
        req.user!.id,
        userRole
      );

      Respond(
        res,
        {
          message: 'Metadata extracted successfully',
          data: metadata,
        },
        200
      );
    } catch (error) {
      throw error;
    }
  }
);

// Add location metadata to file
router.post(
  '/:fileId/metadata/location',
  async (req: Request, res: Response) => {
    try {
      const { fileId } = req.params;
      const {
        latitude,
        longitude,
        altitude,
        accuracy,
        address,
        city,
        country,
      } = req.body;

      if (!latitude || !longitude) {
        throw new APIError({
          STATUS: 400,
          TITLE: 'Invalid Request',
          MESSAGE: 'latitude and longitude are required',
        });
      }

      // Get user role from request (you may need to adjust this based on your auth setup)
      const userRole = (req.user as any)?.role || 'user';

      const metadata = await fileService.addLocationMetadata(
        fileId,
        parseFloat(latitude),
        parseFloat(longitude),
        req.user!.id,
        {
          altitude: altitude ? parseFloat(altitude) : undefined,
          accuracy: accuracy ? parseFloat(accuracy) : undefined,
          address,
          city,
          country,
        },
        userRole
      );

      Respond(
        res,
        {
          message: 'Location metadata added successfully',
          data: metadata,
        },
        200
      );
    } catch (error) {
      throw error;
    }
  }
);

// Add custom metadata to file
router.post('/:fileId/metadata/custom', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const { key, value } = req.body;

    if (!key || value === undefined) {
      throw new APIError({
        STATUS: 400,
        TITLE: 'Invalid Request',
        MESSAGE: 'key and value are required',
      });
    }

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const metadata = await fileService.addCustomMetadata(
      fileId,
      key,
      value,
      req.user!.id,
      userRole
    );

    Respond(
      res,
      {
        message: 'Custom metadata added successfully',
        data: metadata,
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

// Search files by location
router.get('/search/location', async (req: Request, res: Response) => {
  try {
    const {
      latitude,
      longitude,
      radius = 10, // default 10km radius
      page = 1,
      limit = 10,
      uploadedBy,
      uploadedFor,
      entityType,
      isPublic,
      tags,
    } = req.query;

    if (!latitude || !longitude) {
      throw new APIError({
        STATUS: 400,
        TITLE: 'Invalid Request',
        MESSAGE: 'latitude and longitude are required',
      });
    }

    const options = {
      uploadedBy: uploadedBy as string,
      uploadedFor: uploadedFor as string,
      entityType: entityType as string,
      isPublic: isPublic === 'true',
      tags: tags
        ? (tags as string).split(',').map((tag) => tag.trim())
        : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const files = await fileService.searchFilesByLocation(
      parseFloat(latitude as string),
      parseFloat(longitude as string),
      parseFloat(radius as string),
      options,
      req.user!.id,
      userRole
    );

    Respond(
      res,
      {
        message: 'Files found by location',
        data: files,
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

// Get files with metadata filters
router.get('/metadata/filter', async (req: Request, res: Response) => {
  try {
    const {
      hasLocation,
      hasImageMetadata,
      deviceMake,
      deviceModel,
      page = 1,
      limit = 10,
      uploadedBy,
      uploadedFor,
      entityType,
      isPublic,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const options = {
      hasLocation: hasLocation === 'true',
      hasImageMetadata: hasImageMetadata === 'true',
      deviceMake: deviceMake as string,
      deviceModel: deviceModel as string,
      uploadedBy: uploadedBy as string,
      uploadedFor: uploadedFor as string,
      entityType: entityType as string,
      isPublic: isPublic === 'true',
      tags: tags
        ? (tags as string).split(',').map((tag) => tag.trim())
        : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    // Get user role from request (you may need to adjust this based on your auth setup)
    const userRole = (req.user as any)?.role || 'user';

    const files = await fileService.getFilesWithMetadata(
      options,
      req.user!.id,
      userRole
    );

    Respond(
      res,
      {
        message: 'Files with metadata filters fetched successfully',
        data: files,
      },
      200
    );
  } catch (error) {
    throw error;
  }
});

export default router;
