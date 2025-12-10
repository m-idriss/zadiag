import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/shared/components/glass_container.dart';
import 'package:zadiag/shared/components/glass_scaffold.dart';
import 'package:zadiag/core/services/log_service.dart';

import 'providers/converter_state.dart';
import 'services/converter_service.dart';
import 'services/ics_generator.dart';
import 'services/ics_export_service.dart';
import 'services/conversion_history_service.dart';
import 'widgets/event_card.dart';
import 'widgets/image_upload_zone.dart';
import 'widgets/calendar/calendar_view.dart';
import 'widgets/calendar/calendar_header.dart'; // For CalendarViewMode
import 'utils/calendar_utils.dart';
import 'models/calendar_event.dart'; // For CalendarEvent

/// Main page for the Image to ICS Converter feature.
class ConverterPage extends ConsumerStatefulWidget {
  const ConverterPage({super.key});

  @override
  ConsumerState<ConverterPage> createState() => _ConverterPageState();
}

class _ConverterPageState extends ConsumerState<ConverterPage>
    with SingleTickerProviderStateMixin {
  final ConverterService _converterService = ConverterService();
  final IcsGenerator _icsGenerator = IcsGenerator();
  final IcsExportService _icsExportService = IcsExportService();
  final ConversionHistoryService _historyService = ConversionHistoryService();

  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  int _eventsGenerated = 28453;
  int _imagesProcessed = 2112;
  int _hoursSaved = 198;
  int _workdaysSaved = 25;

  bool _showCalendarView = false;

  // Calendar state
  CalendarViewMode _calendarMode = CalendarViewMode.month;
  DateTime _calendarFocusedDate = DateTime.now();
  DateTime? _calendarSelectedDate;

  List<CalendarEvent> _getFilteredEvents(List<CalendarEvent> allEvents) {
    if (!_showCalendarView) {
      return allEvents;
    }

    if (_calendarSelectedDate != null) {
      return CalendarUtils.getEventsForDate(allEvents, _calendarSelectedDate!);
    }

    switch (_calendarMode) {
      case CalendarViewMode.month:
        return allEvents.where((event) {
          return event.startDateTime.year == _calendarFocusedDate.year &&
              event.startDateTime.month == _calendarFocusedDate.month;
        }).toList();
      case CalendarViewMode.week:
        return CalendarUtils.getEventsForWeek(allEvents, _calendarFocusedDate);
      case CalendarViewMode.day:
        return CalendarUtils.getEventsForDate(allEvents, _calendarFocusedDate);
    }
  }

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
      ),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.2, 0.8, curve: Curves.easeOutCubic),
      ),
    );
    _animationController.forward();

    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        setState(() {
          _eventsGenerated = 28453;
          _imagesProcessed = 2112;
          _hoursSaved = 198;
          _workdaysSaved = 25;
        });
      }
    });
  }

  @override
  void dispose() {
    _animationController.dispose();
    _converterService.dispose();
    super.dispose();
  }

  void _onImagesUploaded(List<UploadedImage> images) {
    Log.i('ConverterPage: ${images.length} images uploaded');
    ref.read(converterProvider.notifier).setUploadedImages(images);
  }

  Future<void> _processImages() async {
    final notifier = ref.read(converterProvider.notifier);
    final state = ref.read(converterProvider);

    if (state.uploadedImages.isEmpty) {
      Log.w('ConverterPage: Attempted processing with no images');
      showSnackBar(context, trad(context)!.please_upload_image, true);
      return;
    }

    Log.i(
      'ConverterPage: Starting image processing for ${state.uploadedImages.length} images',
    );
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
        Log.i(
          'ConverterPage: Processing successful. Found ${result.eventCount} events.',
        );
        notifier.setConversionResult(
          events: result.events,
          icsContent: result.icsContent,
        );

        // Auto-save to history
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          try {
            // Collect paths from uploaded images
            final filePaths =
                state.uploadedImages
                    .map((img) => img.path)
                    .where((path) => path != null)
                    .cast<String>()
                    .toList();

            await _historyService.saveConversion(
              events: result.events,
              icsContent: result.icsContent ?? '',
              originalFilePaths: filePaths,
            );
          } catch (e) {
            Log.e('ConverterPage: Error auto-saving to history', e);
            // Silently fail - don't interrupt the user flow
          }
        }
      } else {
        Log.w(
          'ConverterPage: Processing returned no events or failed. Error: ${result.errorMessage}',
        );
        notifier.setConversionResult(
          events: [],
          errorMessage: result.errorMessage ?? trad(context)!.no_events_found,
        );
      }
    } catch (e, stack) {
      Log.e('ConverterPage: Error processing images', e, stack);
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
      Log.w('ConverterPage: Attempted ICS export with no events');
      showSnackBar(context, trad(context)!.no_events_to_export, true);
      return;
    }

    Log.i('ConverterPage: Starting ICS export');
    notifier.setExporting(true);

    try {
      String? icsContent = state.generatedIcs;
      if (icsContent == null) {
        icsContent = _icsGenerator.generateIcs(state.extractedEvents);
        notifier.setGeneratedIcs(icsContent);
      }

      // Launch calendar addition without waiting for completion
      // This allows the spinner to stop immediately
      _saveIcsFile();
    } catch (e, stack) {
      Log.e('ConverterPage: Error preparing ICS export', e, stack);
      if (!mounted) return;
      showSnackBar(context, '${trad(context)!.error_exporting_ics}: $e', true);
    } finally {
      // Stop spinner immediately so user can interact with calendar
      if (mounted) {
        notifier.setExporting(false);
      }
    }
  }

  Future<void> _saveIcsFile() async {
    final state = ref.read(converterProvider);
    try {
      // Generate ICS content
      String? icsContent = state.generatedIcs;
      icsContent ??= _icsGenerator.generateIcs(state.extractedEvents);

      // Export/share the ICS file
      final fileName = _icsExportService.getUniqueFileName();
      await _icsExportService.exportIcs(icsContent, fileName: fileName);
    } catch (e, stack) {
      Log.e('ConverterPage: Error exporting ICS', e, stack);
      if (!mounted) return;
      showSnackBar(context, '${trad(context)!.error_exporting_ics}: $e', true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(converterProvider);

    return GlassScaffold(
      body: SafeArea(
        bottom: false,
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: SlideTransition(
            position: _slideAnimation,
            child: ListView(
              padding: const EdgeInsets.all(AppTheme.spacingLg),
              physics: const BouncingScrollPhysics(),
              children: [
                _buildHeader(context),
                if (state.extractedEvents.isEmpty) ...[
                  const SizedBox(height: AppTheme.spacingLg),
                  _brandingCard(context, AppTheme.radiusSm),
                ],
                if (state.errorMessage != null) ...[
                  const SizedBox(height: AppTheme.spacingMd),
                  _buildErrorMessage(context, state.errorMessage!),
                ],
                if (state.extractedEvents.isNotEmpty) ...[
                  const SizedBox(height: AppTheme.spacingXl),
                  _buildEventsSection(context, state),
                ],
                const SizedBox(height: AppTheme.spacingLg),
                ImageUploadZone(
                  onImagesUploaded: _onImagesUploaded,
                  isLoading: state.isProcessing,
                  maxImages: 5,
                  initialImages: state.uploadedImages,
                ),
                if (state.extractedEvents.isNotEmpty) ...[
                  const SizedBox(height: AppTheme.spacingLg),
                  _buildExportButton(context, state),
                ],
                if (state.uploadedImages.isNotEmpty && !state.isProcessing) ...[
                  const SizedBox(height: AppTheme.spacingLg),
                  _buildConvertButton(context),
                ],
                if (state.extractedEvents.isEmpty) ...[
                  const SizedBox(height: AppTheme.spacingLg),
                  _buildStatsSection(context),
                ],
                const SizedBox(height: 3 * AppTheme.spacingXxl),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: AppTheme.spacingMd),
        Text(
          trad(context)!.converter_title,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontFamily: AppTheme.defaultFontFamilyName,
            fontSize: 32,
            shadows: [
              Shadow(
                color: Colors.black.withValues(alpha: 0.2),
                offset: const Offset(0, 2),
                blurRadius: 4,
              ),
            ],
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppTheme.spacingSm),
        Text(
          trad(context)!.converter_subtitle,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.9),
            fontSize: 16,
            height: 1.5,
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
          textAlign: TextAlign.center,
        ),
      ],
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
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.4),
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
                const Icon(
                  Icons.auto_awesome_rounded,
                  color: Colors.white,
                  size: 22,
                ),
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
    final filteredEvents = _getFilteredEvents(state.extractedEvents);

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
          // Header with view toggle
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
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.onSurface,
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ),
              const Spacer(),
              // View mode toggle
              _buildViewToggle(context),
            ],
          ),
          const SizedBox(height: AppTheme.spacingMd),

          // Calendar View (if enabled)
          if (_showCalendarView) ...[
            CalendarView(
              key: const ValueKey('calendar'),
              events: state.extractedEvents,
              viewMode: _calendarMode,
              focusedDate: _calendarFocusedDate,
              selectedDate: _calendarSelectedDate,
              onViewModeChanged: (mode) => setState(() => _calendarMode = mode),
              onFocusedDateChanged:
                  (date) => setState(() => _calendarFocusedDate = date),
              onSelectedDateChanged:
                  (date) => setState(() => _calendarSelectedDate = date),
            ),
            const SizedBox(height: AppTheme.spacingMd),
            const Divider(),
            const SizedBox(height: AppTheme.spacingMd),
          ],

          // Filtered List View
          if (filteredEvents.isEmpty)
            Padding(
              padding: const EdgeInsets.all(AppTheme.spacingLg),
              child: Center(
                child: Text(
                  'No events found for this filter',
                  style: TextStyle(
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.5),
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ),
            )
          else
            Column(
              key: ValueKey('list_${filteredEvents.length}'),
              children:
                  filteredEvents.asMap().entries.map((entry) {
                    // We need to find the original index to allow deletion
                    final originalIndex = state.extractedEvents.indexOf(
                      entry.value,
                    );
                    return EventCard(
                      event: entry.value,
                      onDelete:
                          originalIndex != -1
                              ? () => _removeEvent(originalIndex)
                              : null,
                    );
                  }).toList(),
            ),
        ],
      ),
    );
  }

  Widget _buildViewToggle(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildViewToggleButton(
            context,
            icon: Icons.list_rounded,
            isSelected: !_showCalendarView,
            onTap: () => setState(() => _showCalendarView = false),
          ),
          const SizedBox(width: 2),
          _buildViewToggleButton(
            context,
            icon: Icons.calendar_month_rounded,
            isSelected: _showCalendarView,
            onTap: () => setState(() => _showCalendarView = true),
          ),
        ],
      ),
    );
  }

  Widget _buildViewToggleButton(
    BuildContext context, {
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final colorScheme = Theme.of(context).colorScheme;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(AppTheme.spacingSm),
        decoration: BoxDecoration(
          color: isSelected ? colorScheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(AppTheme.radiusXs),
        ),
        child: Icon(
          icon,
          size: 20,
          color:
              isSelected
                  ? Colors.white
                  : colorScheme.onSurface.withValues(alpha: 0.5),
        ),
      ),
    );
  }

  Widget _buildExportButton(BuildContext context, ConverterState state) {
    return Container(
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        color: Theme.of(context).colorScheme.secondary,
        boxShadow: [
          BoxShadow(
            color: Theme.of(
              context,
            ).colorScheme.secondary.withValues(alpha: 0.4),
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
            child:
                state.isExporting
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
                        const Icon(
                          Icons.download_rounded,
                          color: Colors.white,
                          size: 22,
                        ),
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

  Widget _brandingCard(BuildContext context, double radiusLg) {
    return GlassContainer(
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
      child: SizedBox(
        width: double.infinity,
        height: 240,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          child: SvgPicture.asset(
            'assets/images/converter.svg',
            fit: BoxFit.cover,
            semanticsLabel: 'Converter illustration',
            placeholderBuilder:
                (context) => Container(
                  color: Theme.of(context).colorScheme.surface,
                  child: const Center(child: CircularProgressIndicator()),
                ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.bar_chart_rounded,
              color: Theme.of(context).colorScheme.primary,
              size: 28,
            ),
            SizedBox(width: AppTheme.spacingSm),
            Text(
              trad(context)!.powering_productivity,
              style: TextStyle(
                color: Theme.of(context).colorScheme.secondary,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        SizedBox(height: AppTheme.spacingMd),

        _buildStatLine(
          context,
          trad(context)!.pre_events_generated,
          _eventsGenerated,
          trad(context)!.events_generated,
          _imagesProcessed,
          trad(context)!.images,
          Theme.of(context).colorScheme.secondary,
        ),
        SizedBox(height: AppTheme.spacingSm),

        _buildStatLine(
          context,
          trad(context)!.pre_hours_saved,
          _hoursSaved,
          trad(context)!.hours_saved,
          _workdaysSaved,
          trad(context)!.workdays_saved,
          Theme.of(context).colorScheme.secondary,
        ),
        SizedBox(height: AppTheme.spacingSm),
      ],
    );
  }

  Widget _buildStatLine(
    BuildContext context,
    String pretext,
    int value1,
    String text1,
    int? value2,
    String? text2,
    Color accentColor,
  ) {
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          Text(
            "$pretext ",
            style: TextStyle(
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.85),
              fontSize: 18,
              fontWeight: FontWeight.w500,
            ),
          ),
          _buildAnimatedCounter(value1, accentColor),
          SizedBox(width: AppTheme.spacingSm / 2),
          Text(
            text1,
            style: TextStyle(
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.85),
              fontSize: 18,
              fontWeight: FontWeight.w500,
            ),
          ),
          if (value2 != null) ...[
            SizedBox(width: AppTheme.spacingMd),
            _buildAnimatedCounter(value2, accentColor),
            SizedBox(width: AppTheme.spacingSm / 2),
            Text(
              text2!,
              style: TextStyle(
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.85),
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAnimatedCounter(int targetValue, Color accentColor) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: targetValue.toDouble()),
      duration: const Duration(seconds: 1),
      builder: (context, value, child) {
        final formatter = NumberFormat('#,###', 'fr_FR');
        return Text(
          formatter.format(value.toInt()),
          style: TextStyle(
            color: accentColor,
            fontSize: 20,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.5,
          ),
        );
      },
    );
  }
}
