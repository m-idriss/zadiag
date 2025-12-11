import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:zadiag/shared/components/glass_container.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/services/log_service.dart';

/// Model representing an uploaded file (image or PDF).
class UploadedImage {
  /// The file data as bytes
  final Uint8List bytes;

  /// Original file name
  final String name;

  /// MIME type of the file
  final String mimeType;

  /// File path (optional, as it might be from memory)
  final String? path;

  UploadedImage({
    required this.bytes,
    required this.name,
    required this.mimeType,
    this.path,
  });

  /// Returns true if this is a PDF file
  bool get isPdf => mimeType == 'application/pdf';

  /// Returns true if this is an image file
  bool get isImage => mimeType.startsWith('image/');
}

/// Widget for uploading images with drag-and-drop and file picker support.
class ImageUploadZone extends StatefulWidget {
  /// Callback when images are uploaded
  final Function(List<UploadedImage>) onImagesUploaded;

  /// Maximum number of images allowed
  final int maxImages;

  /// Whether upload is in progress
  final bool isLoading;

  /// Initial list of uploaded images (for state restoration)
  final List<UploadedImage> initialImages;

  /// Whether to show in read-only mode (hide upload zone, show only files)
  final bool readOnly;

  const ImageUploadZone({
    super.key,
    required this.onImagesUploaded,
    this.maxImages = 5,
    this.isLoading = false,
    this.initialImages = const [],
    this.readOnly = false,
  });

  @override
  State<ImageUploadZone> createState() => _ImageUploadZoneState();
}

class _ImageUploadZoneState extends State<ImageUploadZone> {
  late List<UploadedImage> _uploadedImages;
  final ImagePicker _imagePicker = ImagePicker();
  final bool _isDragging = false;
  bool _isPickerActive = false;

  @override
  void initState() {
    super.initState();
    _uploadedImages = List.from(widget.initialImages);
  }

  @override
  void didUpdateWidget(ImageUploadZone oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Sync with parent state if images changed externally
    if (!listEquals(widget.initialImages, oldWidget.initialImages)) {
      _uploadedImages = List.from(widget.initialImages);
    }
  }

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
        // Upload zone - only show if not readOnly
        if (!widget.readOnly)
          GlassContainer(
            borderRadius: AppTheme.radiusXl,
            opacity: _isDragging ? 0.95 : 0.85,
            border: Border.all(
              color:
                  _isDragging
                      ? colorScheme.primary
                      : colorScheme.outline.withValues(alpha: 0.5),
              width: _isDragging ? 2 : 1,
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap:
                    widget.isLoading || _isPickerActive
                        ? null
                        : _showImageSourceSelection,
                borderRadius: BorderRadius.circular(AppTheme.radiusXl),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppTheme.spacingLg,
                    vertical: AppTheme.spacingMd,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (widget.isLoading) ...[
                        SizedBox(
                          width: 36,
                          height: 36,
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            color: colorScheme.primary,
                          ),
                        ),
                        const SizedBox(height: AppTheme.spacingSm),
                        Text(
                          trad(context)!.processing_images,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: colorScheme.onSurface,
                            fontFamily: AppTheme.defaultFontFamilyName,
                          ),
                        ),
                      ] else ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: colorScheme.primary.withValues(
                                  alpha: 0.1,
                                ),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.cloud_upload_outlined,
                                size: 24,
                                color: colorScheme.primary,
                              ),
                            ),
                            const SizedBox(width: AppTheme.spacingMd),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    trad(context)!.upload_files,
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w600,
                                      color: colorScheme.onSurface,
                                      fontFamily:
                                          AppTheme.defaultFontFamilyName,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${trad(context)!.supported_formats} (Max ${widget.maxImages})',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: colorScheme.onSurface.withValues(
                                        alpha: 0.5,
                                      ),
                                      fontFamily:
                                          AppTheme.defaultFontFamilyName,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),

        // File preview grid
        if (_uploadedImages.isNotEmpty) ...[
          const SizedBox(height: AppTheme.spacingSm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                trad(context)!.files_selected(_uploadedImages.length),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: colorScheme.onSurface,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
              ),
              TextButton.icon(
                onPressed: _clearAllImages,
                icon: Icon(
                  Icons.clear_all_rounded,
                  size: 16,
                  color: colorScheme.error,
                ),
                label: Text(
                  trad(context)!.clear_all,
                  style: TextStyle(
                    color: colorScheme.error,
                    fontSize: 12,
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppTheme.spacingXs),
          SizedBox(
            height: 60,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _uploadedImages.length,
              separatorBuilder:
                  (_, _) => const SizedBox(width: AppTheme.spacingSm),
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
    final file = _uploadedImages[index];
    return Stack(
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: Border.all(color: colorScheme.outline),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppTheme.radiusSm - 1),
            child:
                file.isPdf
                    ? Container(
                      color: colorScheme.surfaceContainerHigh,
                      child: Center(
                        child: Icon(
                          Icons.picture_as_pdf,
                          size: 28,
                          color: Colors.red.shade400,
                        ),
                      ),
                    )
                    : Image.memory(
                      file.bytes,
                      fit: BoxFit.cover,
                      errorBuilder:
                          (_, _, _) => Container(
                            color: colorScheme.surfaceContainerHigh,
                            child: Icon(
                              Icons.image_outlined,
                              size: 20,
                              color: colorScheme.onSurface.withValues(
                                alpha: 0.3,
                              ),
                            ),
                          ),
                    ),
          ),
        ),
        Positioned(
          top: 2,
          right: 2,
          child: GestureDetector(
            onTap: () => _removeImage(index),
            child: Container(
              width: 16,
              height: 16,
              decoration: BoxDecoration(
                color: colorScheme.error,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.close_rounded,
                size: 10,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Shows a bottom sheet to let the user choose between Camera, Gallery, or PDF
  void _showImageSourceSelection() {
    if (widget.isLoading || _isPickerActive) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppTheme.radiusLg),
        ),
      ),
      builder:
          (context) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: AppTheme.spacingMd,
                  ),
                  child: Text(
                    trad(context)!.choose_file_source,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.photo_library_outlined),
                  title: Text(trad(context)!.gallery),
                  onTap: () {
                    Navigator.pop(context);
                    _pickImagesFromGallery();
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.camera_alt_outlined),
                  title: Text(trad(context)!.camera),
                  onTap: () {
                    Navigator.pop(context);
                    pickFromCamera();
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.picture_as_pdf_outlined),
                  title: Text(trad(context)!.pdf_files),
                  onTap: () {
                    Navigator.pop(context);
                    _pickPdfFiles();
                  },
                ),
                const SizedBox(height: AppTheme.spacingMd),
              ],
            ),
          ),
    );
  }

  /// Picks images from the device gallery.
  Future<void> _pickImagesFromGallery() async {
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
              content: Text(
                trad(context)!.max_images_allowed(widget.maxImages),
              ),
              duration: const Duration(seconds: 2),
            ),
          );
        }
        return;
      }

      // Pick multiple images from gallery
      final List<XFile> pickedFiles = await _imagePicker.pickMultiImage(
        imageQuality: 85, // Compress images for optimal upload size
        maxWidth: 1920, // Limit max dimensions for reasonable file size
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

          newImages.add(
            UploadedImage(
              bytes: bytes,
              name: file.name,
              mimeType: mimeType,
              path: file.path,
            ),
          );
        } catch (e, stack) {
          Log.e(
            'ImageUploadZone: Error processing image ${file.name}',
            e,
            stack,
          );
        }
      }

      if (newImages.isNotEmpty && mounted) {
        setState(() {
          _uploadedImages.addAll(newImages);
        });
        widget.onImagesUploaded(_uploadedImages);
      }
    } catch (e, stack) {
      Log.e('ImageUploadZone: Error picking images', e, stack);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${trad(context)!.error_selecting_images}: $e'),
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
  /// Handles edge cases like filenames without extensions.
  String _getMimeType(String fileName) {
    final parts = fileName.toLowerCase().split('.');
    // If no extension found (no dot or dot at the end), default to JPEG
    if (parts.length < 2 || parts.last.isEmpty) {
      return 'image/jpeg';
    }
    final extension = parts.last;
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
      case 'pdf':
        return 'application/pdf';
      default:
        return 'image/jpeg'; // Default to JPEG
    }
  }

  /// Picks PDF files from the device.
  Future<void> _pickPdfFiles() async {
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
              content: Text(trad(context)!.max_files_allowed(widget.maxImages)),
              duration: const Duration(seconds: 2),
            ),
          );
        }
        return;
      }

      // Pick PDF files
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        allowMultiple: true,
        withData: true,
      );

      if (result == null || result.files.isEmpty) {
        return; // User cancelled
      }

      // Take only up to remaining allowed files
      final filesToProcess = result.files.take(remaining).toList();

      final newFiles = <UploadedImage>[];
      for (final file in filesToProcess) {
        try {
          if (file.bytes != null) {
            newFiles.add(
              UploadedImage(
                bytes: file.bytes!,
                name: file.name,
                mimeType: 'application/pdf',
                path: file.path,
              ),
            );
          }
        } catch (e, stack) {
          Log.e('ImageUploadZone: Error processing PDF ${file.name}', e, stack);
        }
      }

      if (newFiles.isNotEmpty && mounted) {
        setState(() {
          _uploadedImages.addAll(newFiles);
        });
        widget.onImagesUploaded(_uploadedImages);
      }
    } catch (e, stack) {
      Log.e('ImageUploadZone: Error picking PDF files', e, stack);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${trad(context)!.error_selecting_files}: $e'),
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
              content: Text(
                trad(context)!.max_images_allowed(widget.maxImages),
              ),
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
        path: pickedFile.path,
      );

      if (mounted) {
        setState(() {
          _uploadedImages.add(newImage);
        });
        widget.onImagesUploaded(_uploadedImages);
      }
    } catch (e, stack) {
      Log.e('ImageUploadZone: Error capturing image', e, stack);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${trad(context)!.error_capturing_image}: $e'),
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
