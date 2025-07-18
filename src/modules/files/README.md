# File Management System with Automatic Compression

This module provides a secure file management system that automatically compresses files during upload, returns file URLs instead of server paths, and implements comprehensive access control based on file privacy settings and user roles.

## 🚀 Key Features

### 🔒 Security & Access Control

- **No Server Path Exposure**: Server file paths are never returned in API responses
- **URL-Based Access**: Files are accessed via secure URLs with proper authentication
- **Role-Based Access**: Different access levels for admins, uploaders, and regular users
- **Privacy Controls**: Public and private file support with appropriate access restrictions

### 📁 File Management

- **Upload Support**: Single and multiple file uploads with metadata
- **File Organization**: Entity-based file organization (KPI entries, user profiles, etc.)
- **Metadata Management**: Description, tags, expiration dates, and privacy settings
- **File Compression**: ZIP archive creation for multiple files
- **Statistics**: Comprehensive file usage statistics

### 🗜️ Advanced Image Compression

- **Sharp-Based Processing**: Uses Sharp for high-quality image compression and optimization
- **Multiple Formats**: Generates both compressed PNG and WebP versions
- **Smart Resizing**: Automatically resizes large images while maintaining quality
- **UUID Organization**: Creates unique folders for each file's compressed versions
- **Consistent Naming**: Files follow `{userId}_{fileId}.{ext}` naming convention
- **WebP Support**: Modern format with superior compression ratios
- **Configurable**: Compression settings can be adjusted globally or per upload

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# File compression settings
ENABLE_FILE_COMPRESSION=true
COMPRESSION_QUALITY=85
COMPRESSION_THRESHOLD_SIZE=102400  # 100KB - images are always compressed regardless of size
COMPRESS_IMAGE_TYPES=true
COMPRESS_PDF_TYPES=false
COMPRESS_TEXT_TYPES=true

# Base URL for file access
BASE_URL=http://localhost:3000
```

### Compression Settings

| Setting                      | Default  | Description                                   |
| ---------------------------- | -------- | --------------------------------------------- |
| `ENABLE_FILE_COMPRESSION`    | `true`   | Enable/disable automatic compression globally |
| `COMPRESSION_QUALITY`        | `85`     | Compression quality (0-100)                   |
| `COMPRESSION_THRESHOLD_SIZE` | `102400` | Minimum file size for compression (100KB)     |
| `COMPRESS_IMAGE_TYPES`       | `true`   | Compress image files                          |
| `COMPRESS_PDF_TYPES`         | `false`  | Compress PDF files                            |
| `COMPRESS_TEXT_TYPES`        | `true`   | Compress text-based files                     |

## 📋 Access Control Rules

### Public Files

- **Access**: Available to all authenticated users
- **Download**: Available to all authenticated users
- **URLs**: Always provided in responses

### Private Files

- **Access**: Only available to the file uploader and admin users
- **Download**: Only available to the file uploader and admin users
- **URLs**: Only provided to users with access permissions

### Admin Users

- **Access**: Can access all files (public and private)
- **Management**: Can update, delete, and manage any file
- **Statistics**: Can view comprehensive system statistics
- **Cleanup**: Can perform file cleanup operations

## 🗜️ Compression Features

### Automatic Compression During Upload

Files are automatically compressed during upload if they meet the following criteria:

1. **Size Threshold**: File size exceeds `COMPRESSION_THRESHOLD_SIZE`
2. **File Type**: File type is configured for compression
3. **Benefit Analysis**: Compression provides at least 5% size reduction

### Image Compression Process

#### Image Processing

- **Engine**: Sharp (high-performance image processing)
- **Resizing**: Automatically resizes images larger than 1920x1080
- **Quality**: Configurable quality settings (default: 85%)
- **Formats**: Generates both PNG and WebP versions

#### Folder Structure

```
uploads/
├── [uuid-folder-1]/
│   ├── user123_file456.png (compressed PNG)
│   └── user123_file456.webp (WebP version)
├── [uuid-folder-2]/
│   ├── user789_file789.png
│   └── user789_file789.webp
└── ...
```

#### Compression Results

- **PNG**: Optimized PNG with quality settings and progressive encoding
- **WebP**: Modern format with superior compression (typically 50-70% smaller)
- **Naming**: Consistent `{userId}_{fileId}.{ext}` format
- **Organization**: UUID-based folders prevent naming conflicts

#### Text Files (Legacy)

- **Primary**: Brotli (better compression ratio)
- **Fallback**: Gzip (wider compatibility)
- **Target**: JSON, XML, CSV, HTML, CSS, JavaScript, plain text

#### PDF Files (Legacy)

- **Algorithm**: Gzip (additional compression on already compressed PDFs)
- **Note**: PDFs are already compressed, so additional compression may be minimal

### Compression Information

Each file response includes detailed compression information:

```json
{
  "compressionInfo": {
    "compressed": true,
    "originalSize": 469602,
    "compressedSize": 234801,
    "savingsPercentage": 50.0,
    "compressionType": "webp",
    "folderId": "550e8400-e29b-41d4-a716-446655440000",
    "compressedPaths": {
      "png": "/uploads/550e8400-e29b-41d4-a716-446655440000/user123_file456.png",
      "webp": "/uploads/550e8400-e29b-41d4-a716-446655440000/user123_file456.webp"
    }
  }
}
```

## 📡 API Endpoints

### File Upload

#### Single File Upload

```http
POST /api/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

# Form Data
file: <file>
isPublic: true|false
description: "File description"
tags: "tag1,tag2,tag3"
entityType: "kpi-entry|user-profile|department|template|other"
uploadedFor: "entity-id"
expiresAt: "2024-12-31T23:59:59.000Z"
enableCompression: true|false  # Optional, defaults to true
```

#### Multiple Files Upload

```http
POST /api/files/upload-multiple
Content-Type: multipart/form-data
Authorization: Bearer <token>

# Form Data
files: <file1>
files: <file2>
files: <file3>
isPublic: true|false
description: "Files description"
tags: "tag1,tag2"
enableCompression: true|false  # Optional, defaults to true
```

### File Access

#### List Files

```http
GET /api/files/?page=1&limit=10&isPublic=true&entityType=kpi-entry
Authorization: Bearer <token>
```

#### Get File Metadata

```http
GET /api/files/:fileId
Authorization: Bearer <token>
```

#### Serve File (View in Browser)

```http
GET /api/files/:fileId/serve
Authorization: Bearer <token>
```

#### Serve Compressed Version

```http
GET /api/files/:fileId/compressed/png
Authorization: Bearer <token>

GET /api/files/:fileId/compressed/webp
Authorization: Bearer <token>
```

#### Download File

```http
GET /api/files/:fileId/download
Authorization: Bearer <token>
```

### File Management

#### Update File Metadata

```http
PUT /api/files/:fileId
Content-Type: application/json
Authorization: Bearer <token>

{
  "description": "Updated description",
  "tags": "updated,tags",
  "isPublic": true,
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

#### Delete File

```http
DELETE /api/files/:fileId
Authorization: Bearer <token>
```

### File Organization

#### Get Files by Entity

```http
GET /api/files/entity/:entityType/:entityId
Authorization: Bearer <token>
```

#### Get Public Files

```http
GET /api/files/public/list
Authorization: Bearer <token>
```

### File Operations

#### Compress Multiple Files

```http
POST /api/files/compress
Content-Type: application/json
Authorization: Bearer <token>

{
  "fileIds": ["file-id-1", "file-id-2", "file-id-3"],
  "archiveName": "my-archive.zip"
}
```

#### Compress Entity Files

```http
POST /api/files/compress/entity/:entityType/:entityId
Authorization: Bearer <token>
```

#### Get Compression Statistics

```http
POST /api/files/compress/stats
Content-Type: application/json
Authorization: Bearer <token>

{
  "fileIds": ["file-id-1", "file-id-2"]
}
```

### Administration

#### Get File Statistics

```http
GET /api/files/stats/overview
Authorization: Bearer <token>
```

#### Cleanup Expired Files

```http
POST /api/files/cleanup/expired
Authorization: Bearer <token>
```

## 📊 Response Formats

### File Object with Compression Info

```json
{
  "id": "file-id",
  "originalName": "document.pdf",
  "filename": "unique-filename.pdf",
  "mimetype": "application/pdf",
  "size": 524288,
  "uploadedBy": "user-id",
  "uploadedFor": "entity-id",
  "entityType": "kpi-entry",
  "description": "Monthly report",
  "tags": ["report", "monthly"],
  "isPublic": false,
  "expiresAt": "2024-12-31T23:59:59.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "fileUrl": "http://localhost:3000/api/v1/files/file-id/serve",
  "downloadUrl": "http://localhost:3000/api/v1/files/file-id/download",
  "canAccess": true,
  "canDownload": true,
  "compressionInfo": {
    "compressed": true,
    "originalSize": 1048576,
    "compressedSize": 524288,
    "savingsPercentage": 50.0,
    "compressionType": "brotli"
  }
}
```

### File List Response

```json
{
  "docs": [
    {
      "id": "file-id",
      "originalName": "document.pdf",
      "fileUrl": "http://localhost:3000/api/v1/files/file-id/serve",
      "downloadUrl": "http://localhost:3000/api/v1/files/file-id/download",
      "canAccess": true,
      "canDownload": true,
      "compressionInfo": {
        "compressed": true,
        "originalSize": 1048576,
        "compressedSize": 524288,
        "savingsPercentage": 50.0,
        "compressionType": "brotli"
      }
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

### File Statistics with Compression

```json
{
  "totalFiles": 100,
  "totalSize": 52428800,
  "filesByType": {
    "application/pdf": 25,
    "image/jpeg": 30,
    "text/plain": 45
  },
  "filesByEntity": {
    "kpi-entry": 40,
    "user-profile": 20,
    "department": 25,
    "other": 15
  },
  "publicFiles": 60,
  "privateFiles": 40,
  "userFiles": 15,
  "compressionStats": {
    "compressedFiles": 75,
    "totalSavings": 15728640,
    "averageSavingsPercentage": 30.0
  }
}
```

## 💡 Usage Examples

### Upload with Compression (Default)

```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@large-document.pdf" \
  -F "isPublic=true" \
  -F "description=Large document with automatic compression" \
  -F "tags=document,compressed"
```

### Upload without Compression

```bash
curl -X POST http://localhost:3000/api/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@small-image.jpg" \
  -F "enableCompression=false" \
  -F "description=Small image, no compression needed"
```

### Upload Multiple Files

```bash
curl -X POST http://localhost:3000/api/files/upload-multiple \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@file1.txt" \
  -F "files=@file2.json" \
  -F "files=@file3.pdf" \
  -F "isPublic=true" \
  -F "description=Multiple files with compression"
```

### Get Files with Compression Info

```bash
curl -X GET http://localhost:3000/api/files/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Access Compressed File

```bash
# View file in browser
curl -X GET http://localhost:3000/api/files/FILE_ID/serve \
  -H "Authorization: Bearer YOUR_TOKEN"

# Download file
curl -X GET http://localhost:3000/api/files/FILE_ID/download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded-file.pdf
```

### Get Compression Statistics

```bash
curl -X GET http://localhost:3000/api/files/stats/overview \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🔒 Security Considerations

### File Access Security

- All file access requires authentication
- Server file paths are never exposed in responses
- Access control is enforced at both service and route levels
- Private files are only accessible to uploaders and admins

### Upload Security

- File type validation prevents malicious uploads
- File size limits prevent abuse
- Unique filename generation prevents conflicts
- Proper error handling for upload failures

### Compression Security

- Compression is applied only to files that meet criteria
- Compressed files are stored separately from originals
- Compression algorithms are secure and well-tested
- Failed compression doesn't affect file upload

### URL Security

- File URLs include authentication requirements
- URLs are generated based on user permissions
- No direct file system access through URLs
- Proper content-type headers for file serving

## 🧪 Testing

### Test Compression Functionality

Create a test file and upload it:

```bash
# Create a large text file for testing
echo "This is a test file with repeated content. ".repeat(10000) > test-file.txt

# Upload with compression
curl -X POST http://localhost:3000/api/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-file.txt" \
  -F "isPublic=true"

# Check compression info in response
```

### Test Compression Disabled

```bash
# Upload without compression
curl -X POST http://localhost:3000/api/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-file.txt" \
  -F "enableCompression=false"
```

## 🔧 Integration Notes

### User Role Integration

The system expects user role information in the request object:

```typescript
// In your authentication middleware
req.user = {
  id: 'user-id',
  role: 'admin' | 'user' | 'manager',
};
```

### File Entity Integration

Files can be associated with different entities:

- `kpi-entry`: KPI entry documents
- `user-profile`: User profile pictures/documents
- `department`: Department-specific files
- `template`: System templates
- `other`: General files

### Frontend Integration

Frontend applications should:

- Use the provided `fileUrl` and `downloadUrl` for file access
- Check `canAccess` and `canDownload` flags before showing action buttons
- Display compression information to show space savings
- Handle access denied errors gracefully
- Implement proper loading states for file operations

### Compression Monitoring

Monitor compression effectiveness:

- Track compression ratios over time
- Monitor storage savings
- Adjust compression settings based on file types
- Consider implementing image optimization for better results

## 🚨 Error Handling

### Common Error Responses

```json
{
  "title": "Access Denied",
  "message": "You do not have permission to access this file",
  "success": false,
  "status": 401,
  "timestamp": "January 15, 2024 at 10:30 AM"
}
```

### Error Types

- `400 Bad Request`: Invalid file upload or request data
- `401 Unauthorized`: Authentication required or access denied
- `404 Not Found`: File not found
- `500 Internal Server Error`: Server processing error

## 📈 Performance Considerations

### Compression Performance

- Compression is applied asynchronously during upload
- Large files may take longer to process
- Consider implementing background compression for very large files
- Monitor compression CPU usage on high-traffic systems

### Storage Optimization

- Compressed files are stored separately
- Original files can be deleted after successful compression
- Implement cleanup for failed compression attempts
- Monitor storage usage and compression ratios

### Network Optimization

- Compressed files reduce bandwidth usage
- Consider implementing progressive compression
- Monitor upload/download speeds with compression
- Implement caching for frequently accessed files
