import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_heatmap_calendar/flutter_heatmap_calendar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/providers/conversion_history_provider.dart';
import 'package:zadiag/features/converter/providers/converter_state.dart';
import 'package:zadiag/features/converter/models/conversion_history.dart';
import 'package:zadiag/shared/components/glass_container.dart';

class HeatMapScreen extends ConsumerStatefulWidget {
  const HeatMapScreen({super.key});

  @override
  ConsumerState<HeatMapScreen> createState() => _HeatMapScreenState();
}

class _HeatMapScreenState extends ConsumerState<HeatMapScreen> {
  String _expandedConversionId = '';
  DateTime? _selectedDate;

  @override
  Widget build(BuildContext context) {
    final defaultColorScheme = Theme.of(context).colorScheme;
    final heatmapDataAsync = ref.watch(conversionHeatmapDataProvider);
    final conversionsAsync = ref.watch(conversionHistoryStreamProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: _background(defaultColorScheme),
        child: SafeArea(
          bottom: false,
          child: ListView(
            padding: const EdgeInsets.all(AppTheme.spacingLg),
            physics: const BouncingScrollPhysics(),
            children: [
              _header(context),
              const SizedBox(height: AppTheme.spacingLg),
              heatmapDataAsync.when(
                data:
                    (heatMapDatasets) => _heatMapCard(context, heatMapDatasets),
                loading: () => _buildLoadingCard(context),
                error: (error, stack) => _buildErrorCard(context, error),
              ),
              const SizedBox(height: AppTheme.spacingMd),
              _legendCard(context),
              const SizedBox(height: AppTheme.spacingXl),
              conversionsAsync.when(
                data:
                    (conversions) => _buildArchiveSection(context, conversions),
                loading: () => const SizedBox.shrink(),
                error: (error, stack) => const SizedBox.shrink(),
              ),
              const SizedBox(height: AppTheme.spacingXxl * 2),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    return buildHeader(
      context,
      trad(context)!.activity_tracking,
      trad(context)!.activity_tracking_subtitle,
    );
  }

  BoxDecoration _background(ColorScheme colorScheme) {
    return buildBackground(colorScheme);
  }

  Widget _heatMapCard(
    BuildContext context,
    Map<DateTime, int> heatMapDatasets,
  ) {
    return Container(
      padding: EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: AppTheme.cardShadow,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: HeatMap(
          scrollable: true,
          colorMode: ColorMode.opacity,
          defaultColor: Theme.of(context).colorScheme.surfaceContainerHigh,
          textColor: Theme.of(context).colorScheme.onSurface,
          datasets: heatMapDatasets,
          size: 20,
          colorTipCount: 5,
          colorTipSize: 12,
          showColorTip: false,
          colorsets: {
            1: Theme.of(context).colorScheme.secondary.withValues(alpha: 0.3),
            2: Theme.of(context).colorScheme.secondary.withValues(alpha: 0.5),
            3: Theme.of(context).colorScheme.secondary.withValues(alpha: 0.7),
            4: Theme.of(context).colorScheme.secondary,
          },
          onClick: (value) {
            final clickedDate = DateTime.parse(value.toString());
            final normalizedDate = DateTime(
              clickedDate.year,
              clickedDate.month,
              clickedDate.day,
            );
            setState(() {
              if (_selectedDate == normalizedDate) {
                _selectedDate = null;
              } else {
                _selectedDate = normalizedDate;
              }
            });
          },
        ),
      ),
    );
  }

  Widget _legendCard(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            trad(context)!.less,
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.6),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
          const SizedBox(width: AppTheme.spacingSm),
          ...List.generate(5, (index) {
            return Container(
              width: 16,
              height: 16,
              margin: const EdgeInsets.symmetric(horizontal: 2),
              decoration: BoxDecoration(
                color:
                    index == 0
                        ? Theme.of(context).colorScheme.surfaceContainerHigh
                        : Theme.of(context).colorScheme.secondary.withValues(
                          alpha: 0.25 + (index * 0.2),
                        ),
                borderRadius: BorderRadius.circular(AppTheme.radiusXs),
              ),
            );
          }),
          const SizedBox(width: AppTheme.spacingSm),
          Text(
            trad(context)!.more,
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.6),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingXl),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: AppTheme.cardShadow,
      ),
      child: const Center(child: CircularProgressIndicator()),
    );
  }

  Widget _buildErrorCard(BuildContext context, Object error) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingLg),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: AppTheme.cardShadow,
      ),
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
            'Tap and hold to select and copy the error message',
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
        Row(
          children: [
            Icon(Icons.history_rounded, color: colorScheme.primary, size: 24),
            const SizedBox(width: AppTheme.spacingSm),
            Expanded(
              child: Text(
                trad(context)!.conversion_archive,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurface,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
              ),
            ),
            if (_selectedDate != null)
              GestureDetector(
                onTap: () => setState(() => _selectedDate = null),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        DateFormat('MMM d').format(_selectedDate!),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: colorScheme.onPrimaryContainer,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        Icons.close,
                        size: 14,
                        color: colorScheme.onPrimaryContainer,
                      ),
                    ],
                  ),
                ),
              ),
          ],
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
        else
          ...filtered.take(10).map((conversion) {
            return _buildConversionCard(context, conversion);
          }),
      ],
    );
  }

  Widget _buildConversionCard(
    BuildContext context,
    ConversionHistory conversion,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    final dateFormat = DateFormat('MMM d, yyyy • HH:mm');

    return GlassContainer(
      borderRadius: AppTheme.radiusXl,
      margin: const EdgeInsets.only(bottom: AppTheme.spacingMd),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            setState(() {
              _expandedConversionId =
                  _expandedConversionId == conversion.id ? '' : conversion.id;
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
                        color: colorScheme.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                      ),
                      child: Icon(
                        Icons.event_available_rounded,
                        color: colorScheme.primary,
                        size: 24,
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
                      _expandedConversionId == conversion.id
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                      color: colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ],
                ),
                if (_expandedConversionId == conversion.id) ...[
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

    return Row(
      children: [
        Expanded(
          child: _buildActionButton(
            context,
            icon: Icons.copy_rounded,
            label: trad(context)!.copy,
            onTap: () {
              Clipboard.setData(ClipboardData(text: conversion.icsContent));
              showSnackBar(context, trad(context)!.ics_copied);
            },
            color: colorScheme.primary,
          ),
        ),
        const SizedBox(width: AppTheme.spacingSm),
        Expanded(
          child: _buildActionButton(
            context,
            icon: Icons.visibility_rounded,
            label: trad(context)!.preview,
            onTap: () => _loadInConverter(context, conversion),
            color: colorScheme.secondary,
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    required Color color,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingMd,
              vertical: AppTheme.spacingSm,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: color, size: 18),
                const SizedBox(width: AppTheme.spacingSm),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: color,
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

  void _loadInConverter(BuildContext context, ConversionHistory conversion) {
    // Load events into converter state
    ref
        .read(converterProvider.notifier)
        .setConversionResult(
          events: conversion.events,
          icsContent: conversion.icsContent,
        );

    // Navigate to converter page (index 1 in bottom nav)
    // This assumes the app uses a bottom navigation with converter at index 1
    Navigator.of(context).popUntil((route) => route.isFirst);
  }
}
