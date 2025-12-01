import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/translate.dart';

/// Model representing an uploaded image file.
class UploadedImage {
  /// The image data as bytes
  final Uint8List bytes;

  /// Original file name
  final String name;

  /// MIME type of the image
  final String mimeType;

  UploadedImage({
    required this.bytes,
    required this.name,
    required this.mimeType,
  });
}

/// Widget for uploading images with drag-and-drop and file picker support.
class ImageUploadZone extends StatefulWidget {
  /// Callback when images are uploaded
  final Function(List<UploadedImage>) onImagesUploaded;

  /// Maximum number of images allowed
  final int maxImages;

  /// Whether upload is in progress
  final bool isLoading;

  const ImageUploadZone({
    super.key,
    required this.onImagesUploaded,
    this.maxImages = 5,
    this.isLoading = false,
  });

  @override
  State<ImageUploadZone> createState() => ImageUploadZoneState();
}

class ImageUploadZoneState extends State<ImageUploadZone> {
  final List<UploadedImage> _uploadedImages = [];
  final ImagePicker _imagePicker = ImagePicker();
  bool _isDragging = false;
  bool _isPickerActive = false;

  void _removeImage(int index) {
    setState(() {
      _uploadedImages.removeAt(index);
    });
    widget.onImagesUploaded(_uploadedImages);
  }

  void _clearAllImages() {
    setState(() {
      _uploadedImages.clear();
    });
    widget.onImagesUploaded(_uploadedImages);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Upload zone
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                _isDragging
                    ? colorScheme.primary.withValues(alpha: 0.15)
                    : colorScheme.primary.withValues(alpha: 0.05),
                _isDragging
                    ? colorScheme.secondary.withValues(alpha: 0.15)
                    : colorScheme.secondary.withValues(alpha: 0.05),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppTheme.radiusXl),
            border: Border.all(
              color: _isDragging ? colorScheme.primary : colorScheme.outline,
              width: _isDragging ? 2 : 1,
              strokeAlign: BorderSide.strokeAlignCenter,
            ),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: widget.isLoading || _isPickerActive ? null : _pickImages,
              borderRadius: BorderRadius.circular(AppTheme.radiusXl),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppTheme.spacingXl),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (widget.isLoading) ...[
                      SizedBox(
                        width: 48,
                        height: 48,
                        child: CircularProgressIndicator(
                          strokeWidth: 3,
                          color: colorScheme.primary,
                        ),
                      ),
                      const SizedBox(height: AppTheme.spacingMd),
                      Text(
                        trad(context)!.processing_images,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: colorScheme.onSurface,
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                      ),
                    ] else ...[
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: colorScheme.primary.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.cloud_upload_outlined,
                          size: 36,
                          color: colorScheme.primary,
                        ),
                      ),
                      const SizedBox(height: AppTheme.spacingMd),
                      Text(
                        trad(context)!.upload_images,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: colorScheme.onSurface,
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                      ),
                      const SizedBox(height: AppTheme.spacingSm),
                      Text(
                        trad(context)!.upload_hint,
                        style: TextStyle(
                          fontSize: 13,
                          color: colorScheme.onSurface.withValues(alpha: 0.6),
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: AppTheme.spacingXs),
                      Text(
                        '${trad(context)!.supported_formats} (Max ${widget.maxImages} images)',
                        style: TextStyle(
                          fontSize: 12,
                          color: colorScheme.onSurface.withValues(alpha: 0.4),
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),

        // Image preview grid
        if (_uploadedImages.isNotEmpty) ...[
          const SizedBox(height: AppTheme.spacingMd),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${_uploadedImages.length} image${_uploadedImages.length != 1 ? 's' : ''} selected',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: colorScheme.onSurface,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
              ),
              TextButton.icon(
                onPressed: _clearAllImages,
                icon: Icon(
                  Icons.clear_all_rounded,
                  size: 18,
                  color: colorScheme.error,
                ),
                label: Text(
                  trad(context)!.clear_all,
                  style: TextStyle(
                    color: colorScheme.error,
                    fontSize: 13,
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppTheme.spacingSm),
          SizedBox(
            height: 80,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _uploadedImages.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(width: AppTheme.spacingSm),
              itemBuilder: (context, index) {
                return _buildImageThumbnail(index, colorScheme);
              },
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildImageThumbnail(int index, ColorScheme colorScheme) {
    final image = _uploadedImages[index];
    return Stack(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            border: Border.all(color: colorScheme.outline),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppTheme.radiusMd - 1),
            child: Image.memory(
              image.bytes,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                color: colorScheme.surfaceContainerHigh,
                child: Icon(
                  Icons.image_outlined,
                  color: colorScheme.onSurface.withValues(alpha: 0.3),
                ),
              ),
            ),
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: GestureDetector(
            onTap: () => _removeImage(index),
            child: Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: colorScheme.error,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.close_rounded,
                size: 14,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Picks images from the device gallery.
  Future<void> _pickImages() async {
    if (_isPickerActive) return;
    
    setState(() {
      _isPickerActive = true;
    });

    try {
      final remaining = widget.maxImages - _uploadedImages.length;
      if (remaining <= 0) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Maximum ${widget.maxImages} images allowed'),
              duration: const Duration(seconds: 2),
            ),
          );
        }
        return;
      }

      // Pick multiple images from gallery
      final List<XFile> pickedFiles = await _imagePicker.pickMultiImage(
        imageQuality: 85, // Compress images for optimal upload size
        maxWidth: 1920,   // Limit max dimensions for reasonable file size
        maxHeight: 1920,
      );

      if (pickedFiles.isEmpty) {
        return; // User cancelled
      }

      // Take only up to remaining allowed images
      final filesToProcess = pickedFiles.take(remaining).toList();
      
      final newImages = <UploadedImage>[];
      for (final file in filesToProcess) {
        try {
          final bytes = await file.readAsBytes();
          final mimeType = _getMimeType(file.name);
          
          newImages.add(UploadedImage(
            bytes: bytes,
            name: file.name,
            mimeType: mimeType,
          ));
        } catch (e) {
          if (kDebugMode) {
            print('Error processing image ${file.name}: $e');
          }
        }
      }

      if (newImages.isNotEmpty && mounted) {
        setState(() {
          _uploadedImages.addAll(newImages);
        });
        widget.onImagesUploaded(_uploadedImages);
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error picking images: $e');
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error selecting images: $e'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isPickerActive = false;
        });
      }
    }
  }

  /// Gets the MIME type based on file extension.
  String _getMimeType(String fileName) {
    final extension = fileName.toLowerCase().split('.').last;
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'heic':
      case 'heif':
        return 'image/heic';
      default:
        return 'image/jpeg'; // Default to JPEG
    }
  }

  /// Public method to add images programmatically (for testing or platform-specific implementations)
  void addImages(List<UploadedImage> images) {
    final remaining = widget.maxImages - _uploadedImages.length;
    if (remaining > 0) {
      setState(() {
        _uploadedImages.addAll(images.take(remaining));
      });
      widget.onImagesUploaded(_uploadedImages);
    }
  }

  /// Picks a single image from camera (useful for mobile devices)
  Future<void> pickFromCamera() async {
    if (_isPickerActive) return;
    
    setState(() {
      _isPickerActive = true;
    });

    try {
      final remaining = widget.maxImages - _uploadedImages.length;
      if (remaining <= 0) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Maximum ${widget.maxImages} images allowed'),
              duration: const Duration(seconds: 2),
            ),
          );
        }
        return;
      }

      final XFile? pickedFile = await _imagePicker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
        maxWidth: 1920,
        maxHeight: 1920,
      );

      if (pickedFile == null) {
        return; // User cancelled
      }

      final bytes = await pickedFile.readAsBytes();
      final mimeType = _getMimeType(pickedFile.name);
      
      final newImage = UploadedImage(
        bytes: bytes,
        name: pickedFile.name,
        mimeType: mimeType,
      );

      if (mounted) {
        setState(() {
          _uploadedImages.add(newImage);
        });
        widget.onImagesUploaded(_uploadedImages);
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error capturing image: $e');
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error capturing image: $e'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isPickerActive = false;
        });
      }
    }
  }
}
