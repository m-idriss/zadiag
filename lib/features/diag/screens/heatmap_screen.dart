import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_heatmap_calendar/flutter_heatmap_calendar.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/providers/conversion_history_provider.dart';
import 'package:zadiag/features/converter/providers/converter_state.dart';
import 'package:zadiag/features/converter/models/conversion_history.dart';
import 'package:zadiag/shared/components/glass_container.dart';
import 'package:zadiag/shared/components/glass_scaffold.dart';
import 'package:zadiag/features/diag/providers/bottom_nav_provider.dart';
import 'package:zadiag/features/converter/widgets/image_upload_zone.dart';

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
                const SizedBox(height: AppTheme.spacingMd),
                _legendCard(context),
                const SizedBox(height: AppTheme.spacingXl),
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
        const SizedBox(height: AppTheme.spacingMd),
        Text(
          trad(context)!.activity_tracking,
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
          trad(context)!.activity_tracking_subtitle,
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
              _visibleConversionsCount = _initialItemsCount;
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
                onTap:
                    () => setState(() {
                      _selectedDate = null;
                      _visibleConversionsCount = _initialItemsCount;
                    }),
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

    return GlassContainer(
      borderRadius: AppTheme.radiusXl,
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
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
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
                        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                        child: _buildConversionIcon(context, conversion),
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

    return _buildActionButton(
      context,
      icon: Icons.visibility_rounded,
      label: trad(context)!.preview,
      onTap: () => _loadInConverter(context, conversion),
      color: colorScheme.secondary,
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

  Widget _buildConversionIcon(
    BuildContext context,
    ConversionHistory conversion,
  ) {
    if (conversion.originalFilePaths.isEmpty) {
      return Icon(
        Icons.event_available_rounded,
        color: Theme.of(context).colorScheme.primary,
        size: 24,
      );
    }

    final path = conversion.originalFilePaths.first;
    final isPdf = path.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      return Container(
        color: Theme.of(context).colorScheme.surfaceContainerHigh,
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
          color: Theme.of(context).colorScheme.surfaceContainerHigh,
          child: Icon(
            Icons.image_not_supported_outlined,
            size: 20,
            color: Theme.of(
              context,
            ).colorScheme.onSurface.withValues(alpha: 0.5),
          ),
        );
      },
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
