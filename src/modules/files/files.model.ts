import mongoose, { Schema, Document } from 'mongoose';
import { z } from 'zod';

// Zod schema for file validation
export const FileSchema = z.object({
  originalName: z.string().min(1, 'Original name is required'),
  filename: z.string().min(1, 'Filename is required'),
  mimetype: z.string().min(1, 'MIME type is required'),
  size: z.number().positive('File size must be positive'),
  path: z.string().min(1, 'File path is required'),
  uploadedBy: z.string().min(1, 'Uploader ID is required'),
  uploadedFor: z.string().optional(), // ID of the entity this file is uploaded for (KPI entry, user, etc.)
  entityType: z
    .enum(['kpi-entry', 'user-profile', 'department', 'template', 'other'])
    .default('other'),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().default(false),
  expiresAt: z.date().optional(),
  metadata: z
    .object({
      // Location metadata
      location: z
        .object({
          latitude: z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
          altitude: z.number().optional(),
          accuracy: z.number().optional(),
          address: z.string().optional(),
          city: z.string().optional(),
          country: z.string().optional(),
        })
        .optional(),
      // Image metadata
      image: z
        .object({
          width: z.number().positive().optional(),
          height: z.number().positive().optional(),
          orientation: z.number().optional(),
          exif: z.record(z.any()).optional(),
          camera: z.string().optional(),
          lens: z.string().optional(),
          aperture: z.number().optional(),
          shutterSpeed: z.number().optional(),
          iso: z.number().optional(),
          focalLength: z.number().optional(),
        })
        .optional(),
      // Device metadata
      device: z
        .object({
          make: z.string().optional(),
          model: z.string().optional(),
          software: z.string().optional(),
          version: z.string().optional(),
        })
        .optional(),
      // Custom metadata
      custom: z.record(z.any()).optional(),
    })
    .optional(),
  compressionInfo: z
    .object({
      compressed: z.boolean().default(false),
      originalSize: z.number().positive(),
      compressedSize: z.number().positive().optional(),
      savingsPercentage: z.number().min(0).max(100).optional(),
      compressionType: z.enum(['png', 'webp', 'both', 'none']).optional(),
      folderId: z.string().optional(),
      compressionStatus: z
        .enum(['processing', 'completed', 'failed'])
        .optional(),
      compressedPaths: z
        .object({
          png: z.string().optional(),
          webp: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type FileInput = z.infer<typeof FileSchema>;

// Mongoose schema
const fileSchema = new Schema<FileInput & Document>(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    path: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: String,
      required: true,
      ref: 'User',
    },
    uploadedFor: {
      type: String,
      required: false,
    },
    entityType: {
      type: String,
      enum: ['kpi-entry', 'user-profile', 'department', 'template', 'other'],
      default: 'other',
    },
    description: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    isPublic: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
    },
    metadata: {
      location: {
        latitude: { type: Number, min: -90, max: 90 },
        longitude: { type: Number, min: -180, max: 180 },
        altitude: { type: Number },
        accuracy: { type: Number },
        address: { type: String },
        city: { type: String },
        country: { type: String },
      },
      image: {
        width: { type: Number, min: 1 },
        height: { type: Number, min: 1 },
        orientation: { type: Number },
        exif: { type: Schema.Types.Mixed },
        camera: { type: String },
        lens: { type: String },
        aperture: { type: Number },
        shutterSpeed: { type: Number },
        iso: { type: Number },
        focalLength: { type: Number },
      },
      device: {
        make: { type: String },
        model: { type: String },
        software: { type: String },
        version: { type: String },
      },
      custom: { type: Schema.Types.Mixed },
    },
    compressionInfo: {
      compressed: {
        type: Boolean,
        default: false,
      },
      originalSize: {
        type: Number,
        required: true,
        min: 0,
      },
      compressedSize: {
        type: Number,
        min: 0,
      },
      savingsPercentage: {
        type: Number,
        min: 0,
        max: 100,
      },
      compressionType: {
        type: String,
        enum: ['png', 'webp', 'both', 'none'],
      },
      folderId: {
        type: String,
      },
      compressionStatus: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing',
      },
      compressedPaths: {
        png: {
          type: String,
        },
        webp: {
          type: String,
        },
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.path; // Remove server path from JSON response
        // Remove compressedPaths from compressionInfo to hide folder structure
        if (ret.compressionInfo && ret.compressionInfo.compressedPaths) {
          delete ret.compressionInfo.compressedPaths;
        }
        return ret;
      },
    },
  }
);

// Indexes for better query performance
fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ uploadedFor: 1 });
fileSchema.index({ entityType: 1 });
fileSchema.index({ isPublic: 1 });
fileSchema.index({ createdAt: -1 });
fileSchema.index({ expiresAt: 1 });
fileSchema.index({ 'compressionInfo.compressed': 1 });
fileSchema.index({
  'metadata.location.latitude': 1,
  'metadata.location.longitude': 1,
});
fileSchema.index({ 'metadata.image.width': 1, 'metadata.image.height': 1 });
fileSchema.index({ 'metadata.device.make': 1, 'metadata.device.model': 1 });

// Method to check if file is expired
fileSchema.methods.isExpired = function (): boolean {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Method to generate file URL based on access permissions
fileSchema.methods.getFileUrl = function (
  userId: string,
  userRole?: string
): string | null {
  // Public files are accessible to everyone
  if (this.isPublic) {
    return `/api/files/${this.id}/serve`;
  }

  // Private files are only accessible to uploader or admins
  if (this.uploadedBy === userId || userRole === 'admin') {
    return `/api/files/${this.id}/serve`;
  }

  // No access
  return null;
};

// Method to generate download URL based on access permissions
fileSchema.methods.getDownloadUrl = function (
  userId: string,
  userRole?: string
): string | null {
  // Public files are downloadable by everyone
  if (this.isPublic) {
    return `/api/files/${this.id}/download`;
  }

  // Private files are only downloadable by uploader or admins
  if (this.uploadedBy === userId || userRole === 'admin') {
    return `/api/files/${this.id}/download`;
  }

  // No access
  return null;
};

// Method to extract metadata from file
fileSchema.methods.extractMetadata = async function (): Promise<void> {
  try {
    if (this.mimetype.startsWith('image/')) {
      const sharp = require('sharp');
      const image = sharp(this.path);
      const metadata = await image.metadata();

      // Update image metadata
      this.metadata = {
        ...this.metadata,
        image: {
          width: metadata.width,
          height: metadata.height,
          orientation: metadata.orientation,
          ...this.metadata?.image,
        },
      };

      // Try to extract EXIF data
      try {
        const exif = await image.exif();
        if (exif) {
          this.metadata.image.exif = exif;
        }
      } catch (exifError) {
        // EXIF extraction failed, continue without it
      }

      await this.save();
    }
  } catch (error) {
    console.error('Error extracting metadata:', error);
  }
};

// Method to add location metadata
fileSchema.methods.addLocationMetadata = function (
  latitude: number,
  longitude: number,
  options?: {
    altitude?: number;
    accuracy?: number;
    address?: string;
    city?: string;
    country?: string;
  }
): void {
  this.metadata = {
    ...this.metadata,
    location: {
      latitude,
      longitude,
      ...options,
    },
  };
};

// Method to add custom metadata
fileSchema.methods.addCustomMetadata = function (
  key: string,
  value: any
): void {
  this.metadata = {
    ...this.metadata,
    custom: {
      ...this.metadata?.custom,
      [key]: value,
    },
  };
};

// Define static methods interface
interface FileModelStatic {
  new (data: any): any;
  findExpired(): Promise<any[]>;
  findByEntity(entityType: string, entityId: string): Promise<any[]>;
  findPublic(): Promise<any[]>;
  findById(id: string): Promise<any>;
  findOne(query: any): Promise<any>;
  find(query: any): any;
  countDocuments(query?: any): Promise<number>;
  findByIdAndUpdate(id: string, update: any, options?: any): Promise<any>;
  findByIdAndDelete(id: string): Promise<any>;
  aggregate(pipeline: any[]): Promise<any[]>;
  create(data: any): Promise<any>;
}

// Static method to find expired files
fileSchema.statics.findExpired = function () {
  return this.find({
    expiresAt: { $lt: new Date() },
  });
};

// Static method to find files by entity
fileSchema.statics.findByEntity = function (
  entityType: string,
  entityId: string
) {
  return this.find({
    entityType,
    uploadedFor: entityId,
  }).sort({ createdAt: -1 });
};

// Static method to find public files
fileSchema.statics.findPublic = function () {
  return this.find({ isPublic: true }).sort({ createdAt: -1 });
};

export const FileModel = mongoose.model<FileInput & Document, FileModelStatic>(
  'tbl_files',
  fileSchema
);
