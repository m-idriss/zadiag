import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';

import 'models/calendar_event.dart';
import 'models/conversion_result.dart';
import 'services/converter_service.dart';
import 'services/ics_generator.dart';
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

  List<UploadedImage> _uploadedImages = [];
  List<CalendarEvent> _extractedEvents = [];
  bool _isProcessing = false;
  String? _errorMessage;
  String? _generatedIcs;

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

  void _downloadIcs() {
    if (_generatedIcs == null) {
      _generateIcsFile();
    }

    // For now, show the ICS content in a dialog
    // In production, this would use url_launcher or share_plus to save/share the file
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Generated ICS File'),
        content: SingleChildScrollView(
          child: SelectableText(
            _generatedIcs ?? '',
            style: const TextStyle(
              fontFamily: 'monospace',
              fontSize: 12,
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(trad(context)!.cancel),
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
          onTap: _downloadIcs,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          child: Center(
            child: Row(
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
