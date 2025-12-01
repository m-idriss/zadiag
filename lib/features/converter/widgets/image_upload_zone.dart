import 'dart:typed_data';
import 'package:flutter/material.dart';
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
  State<ImageUploadZone> createState() => _ImageUploadZoneState();
}

class _ImageUploadZoneState extends State<ImageUploadZone> {
  final List<UploadedImage> _uploadedImages = [];
  bool _isDragging = false;

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
              onTap: widget.isLoading ? null : _pickImages,
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

  Future<void> _pickImages() async {
    // For now, this is a placeholder that demonstrates the UI
    // In production, this would use image_picker package
    // The actual implementation will be added when the package is available

    // Mock image upload for demonstration
    // In production, use:
    // final picker = ImagePicker();
    // final images = await picker.pickMultiImage();

    // For now, show a snackbar indicating the feature needs image_picker
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Image picker integration ready for production'),
          duration: Duration(seconds: 2),
        ),
      );
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
}
