import 'dart:io';
import 'package:flutter/material.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/providers/conversion_history_provider.dart';
import 'package:zadiag/features/converter/providers/converter_state.dart';
import 'package:zadiag/features/converter/models/conversion_history.dart';
import 'package:zadiag/shared/components/glass_container.dart';
import 'package:zadiag/shared/components/app_buttons.dart';
import 'package:zadiag/shared/components/glass_scaffold.dart';
import 'package:zadiag/features/diag/providers/bottom_nav_provider.dart';
import 'package:zadiag/features/converter/widgets/image_upload_zone.dart';
import 'package:zadiag/features/diag/widgets/document_viewer_screen.dart';

class HeatMapScreen extends ConsumerStatefulWidget {
  const HeatMapScreen({super.key});

  @override
  ConsumerState<HeatMapScreen> createState() => _HeatMapScreenState();
}

class _HeatMapScreenState extends ConsumerState<HeatMapScreen>
    with SingleTickerProviderStateMixin {
  static const int _initialItemsCount = 10;
  String _expandedConversionId = '';
  DateTime? _selectedDate;
  int _visibleConversionsCount = _initialItemsCount;

  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

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
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final heatmapDataAsync = ref.watch(conversionHeatmapDataProvider);
    final conversionsAsync = ref.watch(conversionHistoryStreamProvider);

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
                _header(context),
                const SizedBox(height: AppTheme.spacingLg),
                heatmapDataAsync.when(
                  data:
                      (heatMapDatasets) =>
                          _heatMapCard(context, heatMapDatasets),
                  loading: () => _buildLoadingCard(context),
                  error: (error, stack) => _buildErrorCard(context, error),
                ),
                //const SizedBox(height: AppTheme.spacingMd),
                //_legendCard(context),
                const SizedBox(height: AppTheme.spacingLg),
                conversionsAsync.when(
                  data:
                      (conversions) =>
                          _buildArchiveSection(context, conversions),
                  loading: () => const SizedBox.shrink(),
                  error: (error, stack) => const SizedBox.shrink(),
                ),
                const SizedBox(height: AppTheme.spacingXxl * 2),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    return Column(
      children: [
        // const SizedBox(height: AppTheme.spacingMd),
        Text(
          trad(context)!.activity_tracking,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onInverseSurface,
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
        /*
        const SizedBox(height: AppTheme.spacingSm),
        Text(
          trad(context)!.activity_tracking_subtitle,
          style: TextStyle(
            color: Theme.of(
              context,
            ).colorScheme.onInverseSurface.withValues(alpha: 0.9),
            fontSize: 16,
            height: 1.5,
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
          textAlign: TextAlign.center,
        ),

         */
      ],
    );
  }

  Widget _heatMapCard(
    BuildContext context,
    Map<DateTime, int> heatMapDatasets,
  ) {
    // Generate dates for the last ~100 days (similar to previous view)
    // We want to end on today or end of this week
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    // Ensure we start on a Sunday to align columns correctly
    // Calculate end date (Saturday of this week)
    final daysUntilSaturday = 6 - today.weekday % 7;
    final endDate = today.add(Duration(days: daysUntilSaturday));

    // We want roughly 14 weeks visible
    const numberOfWeeks = 14;
    final startDate = endDate.subtract(
      const Duration(days: numberOfWeeks * 7 - 1),
    );

    return GlassContainer(
      padding: EdgeInsets.all(AppTheme.spacingMd),
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Day Labels Column
          Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              // Empty space to align with month labels row
              const SizedBox(height: 20),
              _buildDayLabel(context, ''),
              _buildDayLabel(context, 'Mon'),
              _buildDayLabel(context, ''),
              _buildDayLabel(context, 'Wed'),
              _buildDayLabel(context, ''),
              _buildDayLabel(context, 'Fri'),
              _buildDayLabel(context, ''),
            ],
          ),
          const SizedBox(width: AppTheme.spacingSm),

          // Heatmap Grid with Month Labels
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              reverse: true, // Scroll to end (today)
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: List.generate(numberOfWeeks, (weekIndex) {
                  final weekStartDate = startDate.add(
                    Duration(days: weekIndex * 7),
                  );

                  // Check if we should show month label
                  // Show if it's the first visible week, or if the month changed from previous week
                  bool showMonth = false;
                  if (weekIndex == 0) {
                    showMonth = true;
                  } else {
                    final prevWeekStartDate = startDate.add(
                      Duration(days: (weekIndex - 1) * 7),
                    );
                    if (prevWeekStartDate.month != weekStartDate.month) {
                      showMonth = true;
                    }
                  }

                  return Column(
                    children: [
                      // Month Label
                      Container(
                        height: 20,
                        width: 20, // Match cell width
                        alignment: Alignment.bottomLeft,
                        child:
                            showMonth
                                ? Text(
                                  DateFormat.MMM().format(weekStartDate),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurface
                                        .withValues(alpha: 0.7),
                                    fontFamily: AppTheme.defaultFontFamilyName,
                                  ),
                                  overflow: TextOverflow.visible,
                                  softWrap: false,
                                )
                                : null,
                      ),

                      // Days
                      ...List.generate(7, (dayIndex) {
                        // Calculate date for this cell
                        final cellDate = weekStartDate.add(
                          Duration(days: dayIndex),
                        );

                        // Normalize date for comparison
                        final normalizedDate = DateTime(
                          cellDate.year,
                          cellDate.month,
                          cellDate.day,
                        );

                        // Check if it's in the future (optional, depending on desired behavior)
                        if (normalizedDate.isAfter(today)) {
                          return _buildEmptyFutureCell(context);
                        }

                        final value = heatMapDatasets[normalizedDate] ?? 0;
                        final isToday = normalizedDate == today;
                        final isSelected = _selectedDate == normalizedDate;

                        return GestureDetector(
                          onTap: () {
                            setState(() {
                              if (_selectedDate == normalizedDate) {
                                _selectedDate = null;
                              } else {
                                _selectedDate = normalizedDate;
                              }
                              _visibleConversionsCount = _initialItemsCount;
                            });
                          },
                          child: Container(
                            width: 20,
                            height: 20,
                            margin: const EdgeInsets.all(2),
                            decoration: BoxDecoration(
                              color: _getCellColor(context, value),
                              borderRadius: BorderRadius.circular(4),
                              border:
                                  isToday
                                      ? Border.all(
                                        color:
                                            Theme.of(
                                              context,
                                            ).colorScheme.primary,
                                        width: 2,
                                      )
                                      : isSelected
                                      ? Border.all(
                                        color:
                                            Theme.of(
                                              context,
                                            ).colorScheme.onSurface,
                                        width: 1,
                                      )
                                      : null,
                            ),
                          ),
                        );
                      }),
                    ],
                  );
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDayLabel(BuildContext context, String text) {
    return Container(
      height: 20,
      margin: const EdgeInsets.symmetric(vertical: 2),
      alignment: Alignment.center,
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
      ),
    );
  }

  Widget _buildEmptyFutureCell(BuildContext context) {
    return Container(
      width: 20,
      height: 20,
      margin: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }

  Color _getCellColor(BuildContext context, int value) {
    if (value == 0) {
      return Theme.of(context).colorScheme.secondary.withValues(alpha: 0.1);
    }

    // Adapted from original logic
    final opacity =
        value <= 1 ? 0.3 : (value <= 3 ? 0.5 : (value <= 5 ? 0.7 : 1.0));
    return Theme.of(context).colorScheme.secondary.withValues(alpha: opacity);
  }

  Widget _buildLoadingCard(BuildContext context) {
    return GlassContainer(
      padding: const EdgeInsets.all(AppTheme.spacingXl),
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
      child: const Center(child: CircularProgressIndicator()),
    );
  }

  Widget _buildErrorCard(BuildContext context, Object error) {
    return GlassContainer(
      padding: const EdgeInsets.all(AppTheme.spacingLg),
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
      color: Theme.of(
        context,
      ).colorScheme.errorContainer.withValues(alpha: 0.3),
      child: Column(
        children: [
          Icon(
            Icons.error_outline_rounded,
            size: 48,
            color: Theme.of(context).colorScheme.error,
          ),
          const SizedBox(height: AppTheme.spacingMd),
          SelectableText(
            'Error loading heatmap:\n\n$error',
            style: TextStyle(
              color: Theme.of(context).colorScheme.error,
              fontFamily: AppTheme.defaultFontFamilyName,
              fontSize: 14,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Text(
            trad(context)!.error_occurred_please_try_again,
            style: TextStyle(
              color: Theme.of(
                context,
              ).colorScheme.onErrorContainer.withValues(alpha: 0.6),
              fontFamily: AppTheme.defaultFontFamilyName,
              fontSize: 12,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildArchiveSection(
    BuildContext context,
    List<ConversionHistory> conversions,
  ) {
    // Filter by selected date if one is selected
    final filtered =
        _selectedDate == null
            ? conversions
            : conversions.where((c) {
              final d = DateTime(
                c.timestamp.year,
                c.timestamp.month,
                c.timestamp.day,
              );
              return d == _selectedDate;
            }).toList();

    if (conversions.isEmpty) {
      return const SizedBox.shrink();
    }

    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 48,
          child: Row(
            children: [
              Icon(Icons.history_rounded, color: colorScheme.primary, size: 24),
              const SizedBox(width: AppTheme.spacingSm),
              Expanded(
                child: Text(
                  trad(context)!.conversion_archive,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: colorScheme.onInverseSurface,
                    fontFamily: AppTheme.defaultFontFamilyName,
                    shadows: [
                      Shadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        offset: const Offset(0, 2),
                        blurRadius: 4,
                      ),
                    ],
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (_selectedDate != null)
                TextButton.icon(
                  onPressed:
                      () => setState(() {
                        _selectedDate = null;
                        _visibleConversionsCount = _initialItemsCount;
                      }),
                  icon: Icon(
                    Icons.filter_list_off_rounded,
                    size: 16,
                    color: colorScheme.secondary,
                  ),
                  label: Text(
                    'Show all',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: colorScheme.secondary,
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    backgroundColor: colorScheme.secondary.withValues(
                      alpha: 0.1,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: AppTheme.spacingMd),
        if (filtered.isEmpty)
          Padding(
            padding: const EdgeInsets.all(AppTheme.spacingLg),
            child: Center(
              child: Text(
                _selectedDate == null
                    ? trad(context)!.no_conversions_yet
                    : trad(context)!.no_conversions_on_date(
                      DateFormat('MMM d, yyyy').format(_selectedDate!),
                    ),
                style: TextStyle(
                  fontSize: 14,
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ),
          )
        else ...[
          ...filtered.take(_visibleConversionsCount).map((conversion) {
            return _buildConversionCard(context, conversion);
          }),
          if (filtered.length > _visibleConversionsCount)
            Padding(
              padding: const EdgeInsets.only(top: AppTheme.spacingSm),
              child: Center(
                child: TextButton.icon(
                  onPressed: () {
                    setState(() {
                      _visibleConversionsCount += _initialItemsCount;
                    });
                  },
                  icon: Icon(Icons.expand_more, color: colorScheme.primary),
                  label: Text(
                    trad(context)!.show_more,
                    style: TextStyle(
                      color: colorScheme.primary,
                      fontWeight: FontWeight.w600,
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                ),
              ),
            ),
          if (filtered.length > _initialItemsCount &&
              _visibleConversionsCount > _initialItemsCount)
            Padding(
              padding: const EdgeInsets.only(top: AppTheme.spacingSm),
              child: Center(
                child: TextButton.icon(
                  onPressed: () {
                    setState(() {
                      _visibleConversionsCount = _initialItemsCount;
                    });
                  },
                  icon: Icon(Icons.expand_less, color: colorScheme.primary),
                  label: Text(
                    trad(context)!.show_less,
                    style: TextStyle(
                      color: colorScheme.primary,
                      fontWeight: FontWeight.w600,
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }

  Widget _buildConversionCard(
    BuildContext context,
    ConversionHistory conversion,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final dateFormat = DateFormat('MMM d, yyyy • HH:mm');

    return Dismissible(
      key: Key(conversion.id.toString()),
      direction: DismissDirection.endToStart,
      background: Container(
        margin: const EdgeInsets.only(bottom: AppTheme.spacingMd),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: AppTheme.spacingLg),
        decoration: BoxDecoration(
          color: colorScheme.error,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        ),
        child: const Icon(Icons.delete_rounded, color: Colors.white, size: 24),
      ),
      onDismissed: (direction) {
        ref
            .read(conversionHistoryServiceProvider)
            .deleteConversion(conversion.id);
      },
      child: GlassContainer(
        borderRadius: AppTheme.radiusXl,
        opacity: 0.9,
        margin: const EdgeInsets.only(bottom: AppTheme.spacingMd),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              setState(() {
                _expandedConversionId =
                    _expandedConversionId == conversion.id.toString()
                        ? ''
                        : conversion.id.toString();
              });
            },
            borderRadius: BorderRadius.circular(AppTheme.radiusXl),
            child: Padding(
              padding: const EdgeInsets.all(AppTheme.spacingMd),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color:
                              conversion.originalFilePaths.isNotEmpty
                                  ? Colors.transparent
                                  : colorScheme.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(
                            AppTheme.radiusMd,
                          ),
                          border:
                              conversion.originalFilePaths.isNotEmpty
                                  ? Border.all(
                                    color: colorScheme.outline.withValues(
                                      alpha: 0.5,
                                    ),
                                    width: 0.5,
                                  )
                                  : null,
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(
                            AppTheme.radiusMd,
                          ),
                          child: GestureDetector(
                            onTap:
                                conversion.originalFilePaths.isNotEmpty
                                    ? () => _openDocumentViewer(conversion)
                                    : null,
                            child: _buildConversionIcon(context, conversion),
                          ),
                        ),
                      ),
                      const SizedBox(width: AppTheme.spacingMd),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              trad(context)!.events_converted(
                                conversion.eventCount.toString(),
                              ),
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: colorScheme.onSurface,
                                fontFamily: AppTheme.defaultFontFamilyName,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              dateFormat.format(conversion.timestamp),
                              style: TextStyle(
                                fontSize: 13,
                                color: colorScheme.onSurface.withValues(
                                  alpha: 0.6,
                                ),
                                fontFamily: AppTheme.defaultFontFamilyName,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        _expandedConversionId == conversion.id.toString()
                            ? Icons.expand_less_rounded
                            : Icons.expand_more_rounded,
                        color: colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                    ],
                  ),
                  if (_expandedConversionId == conversion.id.toString()) ...[
                    const SizedBox(height: AppTheme.spacingMd),
                    const Divider(),
                    const SizedBox(height: AppTheme.spacingSm),
                    _buildEventsList(context, conversion),
                    const SizedBox(height: AppTheme.spacingMd),
                    _buildActionButtons(context, conversion),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEventsList(BuildContext context, ConversionHistory conversion) {
    final colorScheme = Theme.of(context).colorScheme;
    final dateFormat = DateFormat('MMM d • HH:mm');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          trad(context)!.events,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: colorScheme.onSurface.withValues(alpha: 0.7),
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
        ),
        const SizedBox(height: AppTheme.spacingSm),
        ...conversion.events.map((event) {
          return Padding(
            padding: const EdgeInsets.only(bottom: AppTheme.spacingSm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.circle,
                  size: 8,
                  color: colorScheme.primary.withValues(alpha: 0.5),
                ),
                const SizedBox(width: AppTheme.spacingSm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        event.title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: colorScheme.onSurface,
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                      ),
                      Text(
                        dateFormat.format(event.startDateTime),
                        style: TextStyle(
                          fontSize: 12,
                          color: colorScheme.onSurface.withValues(alpha: 0.5),
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildActionButtons(
    BuildContext context,
    ConversionHistory conversion,
  ) {
    final colorScheme = Theme.of(context).colorScheme;

    return SecondaryButton(
      label: trad(context)!.preview,
      icon: Icons.visibility_rounded,
      onPressed: () => _loadInConverter(context, conversion),
      color: colorScheme.secondary,
      isFullWidth: true,
    );
  }

  Widget _buildConversionIcon(
    BuildContext context,
    ConversionHistory conversion,
  ) {
    if (conversion.originalFilePaths.isEmpty) {
      return Container(
        color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
        child: Center(
          child: Icon(
            Icons.event_available_rounded,
            color: Theme.of(context).colorScheme.primary,
            size: 24,
          ),
        ),
      );
    }

    final path = conversion.originalFilePaths.first;
    final isPdf = path.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      return Container(
        color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
        child: Center(
          child: Icon(
            Icons.picture_as_pdf,
            size: 24,
            color: Colors.red.shade400,
          ),
        ),
      );
    }

    return Image.file(
      File(path),
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) {
        return Container(
          color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
          child: Center(
            child: Icon(
              Icons.event_available_rounded,
              color: Theme.of(context).colorScheme.primary,
              size: 24,
            ),
          ),
        );
      },
    );
  }

  /// Opens the document viewer to display original files
  void _openDocumentViewer(ConversionHistory conversion) {
    if (conversion.originalFilePaths.isEmpty) return;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder:
            (context) => DocumentViewerScreen(
              filePaths: conversion.originalFilePaths,
              initialIndex: 0,
            ),
      ),
    );
  }

  Future<void> _loadInConverter(
    BuildContext context,
    ConversionHistory conversion,
  ) async {
    // Show loading indicator if needed, but for local files it should be fast.
    // We'll read files in the background before navigating.

    final List<UploadedImage> images = [];

    if (conversion.originalFilePaths.isNotEmpty) {
      for (final path in conversion.originalFilePaths) {
        final file = File(path);
        if (await file.exists()) {
          try {
            final bytes = await file.readAsBytes();
            final name = path.split('/').last;
            final isPdf = name.toLowerCase().endsWith('.pdf');
            final mimeType = isPdf ? 'application/pdf' : 'image/jpeg';

            images.add(
              UploadedImage(
                bytes: bytes,
                name: name,
                mimeType: mimeType,
                path: path,
              ),
            );
          } catch (e) {
            // fast fail for this file, continue
            debugPrint('Error reading archived file: $e');
          }
        }
      }
    }

    if (!mounted) return;

    // Load events and images into converter state
    ref
        .read(converterProvider.notifier)
        .restoreConversion(
          events: conversion.events,
          icsContent: conversion.icsContent,
          images: images,
        );

    // Switch to the Converter page using the bottom navigation provider
    ref.read(bottomNavProvider.notifier).selectConverterPage();
  }
}
