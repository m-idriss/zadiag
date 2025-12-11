import 'dart:io';
import 'package:flutter/material.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/shared/components/glass_container.dart';

/// Full-screen document viewer for viewing original conversion files.
///
/// Supports viewing images with zoom/pan functionality and shows
/// appropriate messages for PDF files.
class DocumentViewerScreen extends StatefulWidget {
  /// List of file paths to display
  final List<String> filePaths;

  /// Initial index to display
  final int initialIndex;

  const DocumentViewerScreen({
    super.key,
    required this.filePaths,
    this.initialIndex = 0,
  });

  @override
  State<DocumentViewerScreen> createState() => _DocumentViewerScreenState();
}

class _DocumentViewerScreenState extends State<DocumentViewerScreen> {
  late PageController _pageController;
  late int _currentIndex;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onVerticalDragEnd: (details) {
          // Swipe down to close
          if (details.primaryVelocity != null &&
              details.primaryVelocity! > 300) {
            Navigator.of(context).pop();
          }
        },
        child: Stack(
          children: [
            // Main content - Photo gallery
            PhotoViewGallery.builder(
              scrollPhysics: const BouncingScrollPhysics(),
              builder: (BuildContext context, int index) {
                final path = widget.filePaths[index];
                final file = File(path);
                final isPdf = path.toLowerCase().endsWith('.pdf');

                return PhotoViewGalleryPageOptions.customChild(
                  child: _buildDocumentView(context, file, isPdf),
                  initialScale: PhotoViewComputedScale.contained,
                  minScale: PhotoViewComputedScale.contained,
                  maxScale: PhotoViewComputedScale.covered * 3,
                  heroAttributes: PhotoViewHeroAttributes(
                    tag: 'document_$index',
                  ),
                );
              },
              itemCount: widget.filePaths.length,
              loadingBuilder:
                  (context, event) => Center(
                    child: CircularProgressIndicator(
                      value:
                          event == null
                              ? 0
                              : event.cumulativeBytesLoaded /
                                  event.expectedTotalBytes!,
                      color: colorScheme.primary,
                    ),
                  ),
              backgroundDecoration: const BoxDecoration(color: Colors.black),
              pageController: _pageController,
              onPageChanged: (index) {
                setState(() {
                  _currentIndex = index;
                });
              },
            ),

            // Top bar with close button
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppTheme.spacingMd),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Close button - larger and more prominent
                    Material(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                      child: InkWell(
                        onTap: () => Navigator.of(context).pop(),
                        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
                        child: Container(
                          padding: const EdgeInsets.all(AppTheme.spacingMd),
                          child: Icon(
                            Icons.close_rounded,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                      ),
                    ),

                    // Document counter
                    if (widget.filePaths.length > 1)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppTheme.spacingMd,
                          vertical: AppTheme.spacingSm,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.6),
                          borderRadius: BorderRadius.circular(
                            AppTheme.radiusLg,
                          ),
                        ),
                        child: Text(
                          trad(context)!.document_of(
                            _currentIndex + 1,
                            widget.filePaths.length,
                          ),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            fontFamily: AppTheme.defaultFontFamilyName,
                            fontSize: 14,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Builds the appropriate view for the document (image or PDF placeholder)
  Widget _buildDocumentView(BuildContext context, File file, bool isPdf) {
    final colorScheme = Theme.of(context).colorScheme;

    // Check if file exists
    if (!file.existsSync()) {
      return Center(
        child: GlassContainer(
          padding: const EdgeInsets.all(AppTheme.spacingLg),
          borderRadius: AppTheme.radiusXl,
          opacity: 0.9,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.error_outline_rounded,
                size: 64,
                color: colorScheme.error,
              ),
              const SizedBox(height: AppTheme.spacingMd),
              Text(
                trad(context)!.file_not_found,
                style: TextStyle(
                  color: colorScheme.onSurface,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Handle PDF files
    if (isPdf) {
      return Center(
        child: GlassContainer(
          padding: const EdgeInsets.all(AppTheme.spacingLg),
          borderRadius: AppTheme.radiusXl,
          opacity: 0.9,
          margin: const EdgeInsets.all(AppTheme.spacingLg),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.picture_as_pdf_rounded,
                size: 80,
                color: Colors.red.shade400,
              ),
              const SizedBox(height: AppTheme.spacingMd),
              Text(
                file.path.split('/').last,
                style: TextStyle(
                  color: colorScheme.onSurface,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppTheme.spacingSm),
              Text(
                trad(context)!.pdf_preview_not_available,
                style: TextStyle(
                  color: colorScheme.onSurface.withValues(alpha: 0.7),
                  fontSize: 14,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    // Display image
    return Image.file(
      file,
      fit: BoxFit.contain,
      errorBuilder: (context, error, stackTrace) {
        return Center(
          child: GlassContainer(
            padding: const EdgeInsets.all(AppTheme.spacingLg),
            borderRadius: AppTheme.radiusXl,
            opacity: 0.9,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.broken_image_rounded,
                  size: 64,
                  color: colorScheme.error,
                ),
                const SizedBox(height: AppTheme.spacingMd),
                Text(
                  trad(context)!.error,
                  style: TextStyle(
                    color: colorScheme.onSurface,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
