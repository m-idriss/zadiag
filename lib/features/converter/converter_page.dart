import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';

import 'providers/converter_state.dart';
import 'services/converter_service.dart';
import 'services/ics_generator.dart';
import 'services/ics_export_service.dart';
import 'widgets/event_card.dart';
import 'widgets/image_upload_zone.dart';

/// Main page for the Image to ICS Converter feature.
class ConverterPage extends ConsumerStatefulWidget {
  const ConverterPage({super.key});

  @override
  ConsumerState<ConverterPage> createState() => _ConverterPageState();
}

class _ConverterPageState extends ConsumerState<ConverterPage> {
  final ConverterService _converterService = ConverterService();
  final IcsGenerator _icsGenerator = IcsGenerator();
  final IcsExportService _icsExportService = IcsExportService();

  @override
  void dispose() {
    _converterService.dispose();
    super.dispose();
  }

  void _onImagesUploaded(List<UploadedImage> images) {
    ref.read(converterProvider.notifier).setUploadedImages(images);
  }

  Future<void> _processImages() async {
    final notifier = ref.read(converterProvider.notifier);
    final state = ref.read(converterProvider);
    
    if (state.uploadedImages.isEmpty) {
      showSnackBar(context, trad(context)!.please_upload_image, true);
      return;
    }

    notifier.prepareForConversion();

    try {
      final dataUrls = <String>[];
      final fileNames = <String>[];
      final mimeTypes = <String>[];

      for (final image in state.uploadedImages) {
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

      if (result.success && result.hasEvents) {
        notifier.setConversionResult(
          events: result.events,
          icsContent: result.icsContent,
        );
        showSnackBar(context, trad(context)!.found_events(result.eventCount));
      } else {
        notifier.setConversionResult(
          events: [],
          errorMessage: result.errorMessage ?? trad(context)!.no_events_found,
        );
      }
    } catch (e) {
      if (!mounted) return;
      notifier.setError('${trad(context)!.error_processing_images}: $e');
    }
  }

  void _removeEvent(int index) {
    ref.read(converterProvider.notifier).removeEvent(index);
  }

  Future<void> _downloadIcs() async {
    final notifier = ref.read(converterProvider.notifier);
    final state = ref.read(converterProvider);
    
    if (state.extractedEvents.isEmpty) {
      showSnackBar(context, trad(context)!.no_events_to_export, true);
      return;
    }

    notifier.setExporting(true);

    try {
      String? icsContent = state.generatedIcs;
      if (icsContent == null) {
        icsContent = _icsGenerator.generateIcs(state.extractedEvents);
        notifier.setGeneratedIcs(icsContent);
      }

      await _showDownloadOptionsDialog();
    } catch (e) {
      if (!mounted) return;
      showSnackBar(context, '${trad(context)!.error_exporting_ics}: $e', true);
    } finally {
      if (mounted) {
        notifier.setExporting(false);
      }
    }

  }

  Future<void> _showDownloadOptionsDialog() async {
    final state = ref.read(converterProvider);
    if (state.generatedIcs == null) return;

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
    final state = ref.read(converterProvider);
    try {
      final fileName = _icsExportService.getUniqueFileName();
      final filePath = await _icsExportService.exportIcs(
        state.generatedIcs!,
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
    final state = ref.read(converterProvider);
    if (state.generatedIcs == null) return;
    Clipboard.setData(ClipboardData(text: state.generatedIcs!));
    showSnackBar(context, trad(context)!.ics_copied);
  }

  void _showIcsPreview() {
    final state = ref.read(converterProvider);
    if (state.generatedIcs == null) return;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(trad(context)!.generated_ics_file),
        content: SizedBox(
          width: double.maxFinite,
          height: 400,
          child: SingleChildScrollView(
            child: SelectableText(
              state.generatedIcs!,
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
    final state = ref.watch(converterProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: buildBackground(colorScheme),
        child: SafeArea(
          bottom: false,
          child: ListView(
            padding: const EdgeInsets.all(AppTheme.spacingLg),
            physics: const BouncingScrollPhysics(),
            children: [
              _buildHeader(context),
              if (state.errorMessage != null) ...[
                const SizedBox(height: AppTheme.spacingMd),
                _buildErrorMessage(context, state.errorMessage!),
              ],
              if (state.extractedEvents.isNotEmpty) ...[
                const SizedBox(height: AppTheme.spacingXl),
                _buildEventsSection(context, state),
              ],
              if (state.extractedEvents.isNotEmpty) ...[
                const SizedBox(height: AppTheme.spacingLg),
                _buildExportButton(context, state),
              ],
              const SizedBox(height: AppTheme.spacingLg),
              ImageUploadZone(
                onImagesUploaded: _onImagesUploaded,
                isLoading: state.isProcessing,
                maxImages: 5,
              ),
              if (state.uploadedImages.isNotEmpty && !state.isProcessing) ...[
                const SizedBox(height: AppTheme.spacingLg),
                _buildConvertButton(context)
              ],
              const SizedBox(height: 3 * AppTheme.spacingXxl),
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

  Widget _buildErrorMessage(BuildContext context, String errorMessage) {
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
              errorMessage,
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

  Widget _buildEventsSection(BuildContext context, ConverterState state) {
    return Container(
        padding: EdgeInsets.all(AppTheme.spacingMd),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          boxShadow: AppTheme.cardShadow,
        ),
        child: Column(
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
                '${trad(context)!.extracted_events} (${state.extractedEvents.length})',
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
        ...state.extractedEvents.asMap().entries.map((entry) {
          return EventCard(
            event: entry.value,
            onDelete: () => _removeEvent(entry.key),
          );
        }),
      ],
    ));
  }

  Widget _buildExportButton(BuildContext context, ConverterState state) {
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
          onTap: state.isExporting ? null : _downloadIcs,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          child: Center(
            child: state.isExporting
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
