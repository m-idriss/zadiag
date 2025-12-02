import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';

import 'models/calendar_event.dart';
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
      if (images.isEmpty) {
        _extractedEvents = [];
        _generatedIcs = null;
        _errorMessage = null;
      }
    });
  }

  Future<void> _processImages() async {
    if (_uploadedImages.isEmpty) {
      showSnackBar(context, trad(context)!.please_upload_image, true);
      return;
    }

    setState(() {
      _isProcessing = true;
      _errorMessage = null;
      _generatedIcs = null;
    });

    try {
      final dataUrls = <String>[];
      final fileNames = <String>[];
      final mimeTypes = <String>[];

      for (final image in _uploadedImages) {
        final base64Data = base64Encode(image.bytes);
        dataUrls.add('data:${image.mimeType};base64,$base64Data');
        fileNames.add(image.name);
        mimeTypes.add(image.mimeType);
      }

      final timeZone = DateTime.now().timeZoneName;

      final result = await _converterService.convertImages(
        imageDataUrls: dataUrls,
        fileNames: fileNames,
        mimeTypes: mimeTypes,
        timeZone: timeZone,
      );

      if (!mounted) return;

      setState(() {
        if (result.success && result.hasEvents) {
          _extractedEvents = result.events;
          _generatedIcs = result.icsContent;
          showSnackBar(
              context, trad(context)!.found_events(result.eventCount));
        } else {
          _errorMessage =
              result.errorMessage ?? trad(context)!.no_events_found;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = '${trad(context)!.error_processing_images}: $e';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
        });
      }
    }
  }

  void _removeEvent(int index) {
    setState(() {
      _extractedEvents.removeAt(index);
      _generatedIcs = null;
    });
  }

  Future<void> _downloadIcs() async {
    if (_extractedEvents.isEmpty) {
      showSnackBar(context, trad(context)!.no_events_to_export, true);
      return;
    }

    setState(() {
      _isExporting = true;
    });

    try {
      _generatedIcs ??= _icsGenerator.generateIcs(_extractedEvents);

      await _showDownloadOptionsDialog();
    } catch (e) {
      if (!mounted) return;
      showSnackBar(context, '${trad(context)!.error_exporting_ics}: $e', true);
    } finally {
      if (mounted) {
        setState(() {
          _isExporting = false;
        });
      }
    }

  }

  Future<void> _showDownloadOptionsDialog() async {
    if (_generatedIcs == null) return;

    if (!mounted) return;
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

              _buildOptionTile(
                context,
                icon: Icons.download_rounded,
                title: trad(context)!.save_ics_file,
                subtitle: trad(context)!.save_to_downloads,
                onTap: () async {
                  Navigator.pop(context);
                  await _saveIcsFile();
                },
              ),
              const SizedBox(height: AppTheme.spacingSm),

              _buildOptionTile(
                context,
                icon: Icons.copy_rounded,
                title: trad(context)!.copy_to_clipboard,
                subtitle: trad(context)!.copy_ics_hint,
                onTap: () {
                  Navigator.pop(context);
                  _copyToClipboard();
                },
              ),
              const SizedBox(height: AppTheme.spacingSm),

              _buildOptionTile(
                context,
                icon: Icons.visibility_rounded,
                title: trad(context)!.preview_ics,
                subtitle: trad(context)!.preview_ics_hint,
                onTap: () {
                  Navigator.pop(context);
                  _showIcsPreview();
                },
              ),
              const SizedBox(height: AppTheme.spacingLg),

              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  trad(context)!.cancel,
                  style: TextStyle(
                    color:
                    Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
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

      if (!mounted) return;

      if (filePath != null) {
        showSnackBar(context, trad(context)!.ics_saved_to(filePath));

        final shouldOpen = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: Text(trad(context)!.file_saved),
            content: Text(trad(context)!.file_saved_message),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(trad(context)!.no),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(trad(context)!.open),
              ),
            ],
          ),
        );

        if (!mounted) return;
        if (shouldOpen == true) {
          await _icsExportService.openIcsFile(filePath);
        }
      } else {
        showSnackBar(context, trad(context)!.download_started);
      }
    } catch (e) {
      if (kDebugMode) print('Error saving ICS: $e');
      if (!mounted) return;
      showSnackBar(context, '${trad(context)!.error_saving_file}: $e', true);
    }
  }

  void _copyToClipboard() {
    if (_generatedIcs == null) return;
    Clipboard.setData(ClipboardData(text: _generatedIcs!));
    showSnackBar(context, trad(context)!.ics_copied);
  }

  void _showIcsPreview() {
    if (_generatedIcs == null) return;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(trad(context)!.generated_ics_file),
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
            onPressed: _copyToClipboard,
            child: Text(trad(context)!.copy),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: Text(trad(context)!.close),
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
              ImageUploadZone(
                onImagesUploaded: _onImagesUploaded,
                isLoading: _isProcessing,
                maxImages: 5,
              ),
              const SizedBox(height: AppTheme.spacingLg),
              if (_uploadedImages.isNotEmpty && !_isProcessing)
                _buildConvertButton(context),
              if (_errorMessage != null) ...[
                const SizedBox(height: AppTheme.spacingMd),
                _buildErrorMessage(context),
              ],
              if (_extractedEvents.isNotEmpty) ...[
                const SizedBox(height: AppTheme.spacingXl),
                _buildEventsSection(context),
              ],
              if (_extractedEvents.isNotEmpty) ...[
                const SizedBox(height: AppTheme.spacingLg),
                _buildExportButton(context),
              ],
              const SizedBox(height: 100),
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
                Flexible(
                  child: Text(
                    trad(context)!.convert_button,
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
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
            Flexible(
              child: Text(
                '${trad(context)!.extracted_events} (${_extractedEvents.length})',
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Theme.of(context).colorScheme.onSurface,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
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
                Flexible(
                  child: Text(
                    trad(context)!.download_ics,
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
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
