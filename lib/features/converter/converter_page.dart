import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';

import 'models/calendar_event.dart';
import 'models/conversion_result.dart';
import 'services/converter_service.dart';
import 'services/ics_generator.dart';
import 'services/ics_export_service.dart';
import 'widgets/event_card.dart';
import 'widgets/image_upload_zone.dart';

/// Main page for the Image to ICS Converter feature.
class ConverterPage extends StatefulWidget {
  const ConverterPage({super.key});

  @override
  State<ConverterPage> createState() => _ConverterPageState();
}

class _ConverterPageState extends State<ConverterPage> {
  final ConverterService _converterService = ConverterService();
  final IcsGenerator _icsGenerator = IcsGenerator();
  final IcsExportService _icsExportService = IcsExportService();

  List<UploadedImage> _uploadedImages = [];
  List<CalendarEvent> _extractedEvents = [];
  bool _isProcessing = false;
  bool _isExporting = false;
  String? _errorMessage;
  String? _generatedIcs;

  @override
  void dispose() {
    _converterService.dispose();
    super.dispose();
  }

  void _onImagesUploaded(List<UploadedImage> images) {
    setState(() {
      _uploadedImages = images;
      // Clear previous results when images change
      if (images.isEmpty) {
        _extractedEvents = [];
        _generatedIcs = null;
        _errorMessage = null;
      }
    });
  }

  Future<void> _processImages() async {
    if (_uploadedImages.isEmpty) {
      showSnackBar(context, 'Please upload at least one image', true);
      return;
    }

    setState(() {
      _isProcessing = true;
      _errorMessage = null;
      _generatedIcs = null;
    });

    try {
      // Convert images to data URLs
      final dataUrls = <String>[];
      final fileNames = <String>[];
      final mimeTypes = <String>[];

      for (final image in _uploadedImages) {
        final base64Data = base64Encode(image.bytes);
        dataUrls.add('data:${image.mimeType};base64,$base64Data');
        fileNames.add(image.name);
        mimeTypes.add(image.mimeType);
      }

      // Get user timezone
      final timeZone = DateTime.now().timeZoneName;

      // Call converter service
      final result = await _converterService.convertImages(
        imageDataUrls: dataUrls,
        fileNames: fileNames,
        mimeTypes: mimeTypes,
        timeZone: timeZone,
      );

      setState(() {
        if (result.success && result.hasEvents) {
          _extractedEvents = result.events;
          // Store the ICS content from API if available
          _generatedIcs = result.icsContent;
          showSnackBar(
              context, 'Found ${result.eventCount} events!');
        } else {
          _errorMessage = result.errorMessage ?? 'No events found in images';
        }
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Error processing images: $e';
      });
    } finally {
      setState(() {
        _isProcessing = false;
      });
    }
  }

  void _removeEvent(int index) {
    setState(() {
      _extractedEvents.removeAt(index);
      _generatedIcs = null;
    });
  }

  void _generateIcsFile() {
    if (_extractedEvents.isEmpty) {
      showSnackBar(context, 'No events to export', true);
      return;
    }

    final ics = _icsGenerator.generateIcs(_extractedEvents);
    setState(() {
      _generatedIcs = ics;
    });

    // Show success message
    showSnackBar(context, 'ICS file generated! Ready to download.');
  }

  Future<void> _downloadIcs() async {
    if (_extractedEvents.isEmpty) {
      showSnackBar(context, 'No events to export', true);
      return;
    }

    setState(() {
      _isExporting = true;
    });

    try {
      // Generate ICS if not already generated
      _generatedIcs ??= _icsGenerator.generateIcs(_extractedEvents);

      // Show download options dialog
      await _showDownloadOptionsDialog();
    } catch (e) {
      showSnackBar(context, 'Error exporting ICS: $e', true);
    } finally {
      setState(() {
        _isExporting = false;
      });
    }
  }

  Future<void> _showDownloadOptionsDialog() async {
    if (_generatedIcs == null) return;

    await showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(AppTheme.spacingLg),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppTheme.radiusXl),
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                trad(context)!.download_ics,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: Theme.of(context).colorScheme.onSurface,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppTheme.spacingLg),
              
              // Download/Save option
              _buildOptionTile(
                context,
                icon: Icons.download_rounded,
                title: 'Save ICS File',
                subtitle: 'Save to downloads folder',
                onTap: () async {
                  Navigator.pop(context);
                  await _saveIcsFile();
                },
              ),
              const SizedBox(height: AppTheme.spacingSm),
              
              // Copy to clipboard option
              _buildOptionTile(
                context,
                icon: Icons.copy_rounded,
                title: 'Copy to Clipboard',
                subtitle: 'Copy ICS content to paste elsewhere',
                onTap: () {
                  Navigator.pop(context);
                  _copyToClipboard();
                },
              ),
              const SizedBox(height: AppTheme.spacingSm),
              
              // Preview option
              _buildOptionTile(
                context,
                icon: Icons.visibility_rounded,
                title: 'Preview ICS',
                subtitle: 'View the generated ICS content',
                onTap: () {
                  Navigator.pop(context);
                  _showIcsPreview();
                },
              ),
              const SizedBox(height: AppTheme.spacingLg),
              
              // Cancel button
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  trad(context)!.cancel,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOptionTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: ListTile(
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: colorScheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          ),
          child: Icon(icon, color: colorScheme.primary),
        ),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(
            fontSize: 12,
            color: colorScheme.onSurface.withValues(alpha: 0.6),
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
        ),
        trailing: Icon(
          Icons.arrow_forward_ios_rounded,
          size: 16,
          color: colorScheme.onSurface.withValues(alpha: 0.4),
        ),
        onTap: onTap,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        ),
      ),
    );
  }

  Future<void> _saveIcsFile() async {
    try {
      final fileName = _icsExportService.getUniqueFileName();
      final filePath = await _icsExportService.exportIcs(
        _generatedIcs!,
        fileName: fileName,
      );

      if (filePath != null) {
        showSnackBar(context, 'ICS saved to: $filePath');
        
        // Ask if user wants to open the file
        if (mounted) {
          final shouldOpen = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('File Saved'),
              content: Text('ICS file saved to:\n$filePath\n\nWould you like to open it?'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('No'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('Open'),
                ),
              ],
            ),
          );

          if (shouldOpen == true) {
            await _icsExportService.openIcsFile(filePath);
          }
        }
      } else {
        // Web platform - download triggered
        showSnackBar(context, 'Download started!');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error saving ICS: $e');
      }
      showSnackBar(context, 'Error saving file: $e', true);
    }
  }

  void _copyToClipboard() {
    if (_generatedIcs == null) return;
    
    Clipboard.setData(ClipboardData(text: _generatedIcs!));
    showSnackBar(context, 'ICS content copied to clipboard!');
  }

  void _showIcsPreview() {
    if (_generatedIcs == null) return;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Generated ICS File'),
        content: SizedBox(
          width: double.maxFinite,
          height: 400,
          child: SingleChildScrollView(
            child: SelectableText(
              _generatedIcs!,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 12,
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              _copyToClipboard();
            },
            child: const Text('Copy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: buildBackground(colorScheme),
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(AppTheme.spacingLg),
            physics: const BouncingScrollPhysics(),
            children: [
              _buildHeader(context),
              const SizedBox(height: AppTheme.spacingLg),

              // Image Upload Zone
              ImageUploadZone(
                onImagesUploaded: _onImagesUploaded,
                isLoading: _isProcessing,
                maxImages: 5,
              ),
              const SizedBox(height: AppTheme.spacingLg),

              // Convert Button
              if (_uploadedImages.isNotEmpty && !_isProcessing)
                _buildConvertButton(context),

              // Error Message
              if (_errorMessage != null) ...[
                const SizedBox(height: AppTheme.spacingMd),
                _buildErrorMessage(context),
              ],

              // Extracted Events
              if (_extractedEvents.isNotEmpty) ...[
                const SizedBox(height: AppTheme.spacingXl),
                _buildEventsSection(context),
              ],

              // Export Button
              if (_extractedEvents.isNotEmpty) ...[
                const SizedBox(height: AppTheme.spacingLg),
                _buildExportButton(context),
              ],

              const SizedBox(height: 100), // Bottom padding for nav bar
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return buildHeader(
      context,
      trad(context)!.converter_title,
      trad(context)!.converter_subtitle,
    );
  }

  Widget _buildConvertButton(BuildContext context) {
    return Container(
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primary,
            Theme.of(context).colorScheme.secondary,
          ],
        ),
        boxShadow: [
          BoxShadow(
            color:
                Theme.of(context).colorScheme.primary.withValues(alpha: 0.4),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _processImages,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          child: Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.auto_awesome_rounded,
                    color: Colors.white, size: 22),
                const SizedBox(width: AppTheme.spacingSm),
                Text(
                  trad(context)!.convert_button,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildErrorMessage(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.error.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: Theme.of(context).colorScheme.error.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.error_outline_rounded,
            color: Theme.of(context).colorScheme.error,
            size: 20,
          ),
          const SizedBox(width: AppTheme.spacingSm),
          Expanded(
            child: Text(
              _errorMessage!,
              style: TextStyle(
                color: Theme.of(context).colorScheme.error,
                fontSize: 14,
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEventsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.event_available_rounded,
              color: Theme.of(context).colorScheme.primary,
              size: 24,
            ),
            const SizedBox(width: AppTheme.spacingSm),
            Text(
              '${trad(context)!.extracted_events} (${_extractedEvents.length})',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: Theme.of(context).colorScheme.onSurface,
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppTheme.spacingMd),
        ..._extractedEvents.asMap().entries.map((entry) {
          return EventCard(
            event: entry.value,
            onDelete: () => _removeEvent(entry.key),
          );
        }),
      ],
    );
  }

  Widget _buildExportButton(BuildContext context) {
    return Container(
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        color: Theme.of(context).colorScheme.secondary,
        boxShadow: [
          BoxShadow(
            color:
                Theme.of(context).colorScheme.secondary.withValues(alpha: 0.4),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _isExporting ? null : _downloadIcs,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          child: Center(
            child: _isExporting
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.download_rounded, color: Colors.white, size: 22),
                      const SizedBox(width: AppTheme.spacingSm),
                      Text(
                        trad(context)!.download_ics,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
