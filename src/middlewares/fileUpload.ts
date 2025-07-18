import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { Request } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Configure storage with UUID folders and proper naming
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');

    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate UUID for folder
    const folderId = uuidv4();

    // Get user ID from request (assuming it's available in req.user.id)
    const userId = (req as any).user?.id || 'unknown';

    // Generate a temporary file ID (will be replaced with actual file ID later)
    const tempFileId = crypto.randomBytes(8).toString('hex');

    // Get file extension
    const extension = path.extname(file.originalname);

    // Create filename following the pattern: {userId}_{fileId}.{ext}
    const filename = `${userId}_${tempFileId}${extension}`;

    // Store folder ID and filename in request for later use
    (req as any).uploadInfo = {
      folderId,
      filename,
      tempFileId,
      userId,
    };

    cb(null, filename);
  },
});

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Define allowed file types
  const allowedMimeTypes = [
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',

    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Text files
    'text/plain',
    'text/csv',
    'text/html',
    'text/css',
    'text/javascript',
    'application/json',
    'application/xml',

    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/gzip',

    // Other common types
    'application/octet-stream',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5, // Maximum 5 files per request
  },
});

// Middleware to move file to UUID folder and rename with proper format
export const organizeUploadedFile = async (
  req: Request,
  res: any,
  next: any
) => {
  try {
    if (req.file && (req as any).uploadInfo) {
      const { folderId, filename, tempFileId, userId } = (req as any)
        .uploadInfo;
      const originalPath = req.file.path;

      // Create UUID folder
      const folderPath = path.join(process.cwd(), 'uploads', folderId);
      await fs.mkdir(folderPath, { recursive: true });

      // Move file to UUID folder with proper naming
      const newPath = path.join(folderPath, filename);
      await fs.rename(originalPath, newPath);

      // Update file path in request
      req.file.path = newPath;
      req.file.filename = filename;

      // Store folder info for compression service
      (req as any).fileFolderInfo = {
        folderId,
        folderPath,
        userId,
        tempFileId,
      };

      console.log(`📁 File organized: ${filename} in folder ${folderId}`);
    }
    next();
  } catch (error) {
    console.error('Error organizing uploaded file:', error);
    next(error);
  }
};

// Middleware to log form data after Multer processes it
export const logFormData = (req: Request, res: any, next: any) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    console.log('📁 File Upload Form Data:');
    console.log(
      '  Files:',
      req.files
        ? Array.isArray(req.files)
          ? req.files.length
          : Object.keys(req.files).length
        : 0
    );
    console.log(
      '  File:',
      req.file
        ? {
            originalName: req.file.originalname,
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path,
          }
        : 'No file'
    );
    console.log('  Body fields:', Object.keys(req.body));
    console.log('  Body data:', req.body);

    if ((req as any).fileFolderInfo) {
      console.log('  Folder info:', (req as any).fileFolderInfo);
    }
  }
  next();
};

// Single file upload middleware
export const uploadSingle = upload.single('file');

// Multiple files upload middleware
export const uploadMultiple = upload.array('files', 5);

// Specific field upload middleware
export const uploadFields = upload.fields([
  { name: 'document', maxCount: 1 },
  { name: 'image', maxCount: 3 },
  { name: 'attachment', maxCount: 2 },
]);

// Custom upload middleware with specific configuration
export const createUploadMiddleware = (options: {
  fieldName?: string;
  maxFiles?: number;
  maxFileSize?: number;
  allowedMimeTypes?: string[];
}) => {
  const {
    fieldName = 'file',
    maxFiles = 1,
    maxFileSize = 10 * 1024 * 1024, // 10MB default
    allowedMimeTypes = [],
  } = options;

  const customFileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    const defaultAllowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/json',
      'application/zip',
    ];

    const allowedTypes =
      allowedMimeTypes.length > 0 ? allowedMimeTypes : defaultAllowedTypes;

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  };

  const customStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads');

      try {
        await fs.access(uploadDir);
      } catch {
        await fs.mkdir(uploadDir, { recursive: true });
      }

      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate UUID for folder
      const folderId = uuidv4();

      // Get user ID from request
      const userId = (req as any).user?.id || 'unknown';

      // Generate a temporary file ID
      const tempFileId = crypto.randomBytes(8).toString('hex');

      // Get file extension
      const extension = path.extname(file.originalname);

      // Create filename following the pattern: {userId}_{fileId}.{ext}
      const filename = `${userId}_${tempFileId}${extension}`;

      // Store folder ID and filename in request for later use
      (req as any).uploadInfo = {
        folderId,
        filename,
        tempFileId,
        userId,
      };

      cb(null, filename);
    },
  });

  const customUpload = multer({
    storage: customStorage,
    fileFilter: customFileFilter,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
    },
  });

  return maxFiles === 1
    ? customUpload.single(fieldName)
    : customUpload.array(fieldName, maxFiles);
};

// Error handling middleware for multer errors
export const handleUploadError = (
  error: any,
  req: Request,
  res: any,
  next: any
) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File too large. Maximum size is 10MB.',
          status: 400,
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 5 files allowed.',
          status: 400,
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field.',
          status: 400,
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error.',
          status: 400,
        });
    }
  }

  if (error.message && error.message.includes('File type')) {
    return res.status(400).json({
      success: false,
      message: error.message,
      status: 400,
    });
  }

  next(error);
};

export default upload;
