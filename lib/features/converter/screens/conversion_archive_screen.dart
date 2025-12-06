import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/shared/components/glass_container.dart';

import '../models/conversion_history.dart';
import '../providers/conversion_history_provider.dart';
import '../providers/converter_state.dart';

/// Screen to display and manage conversion history archive
class ConversionArchiveScreen extends ConsumerStatefulWidget {
  const ConversionArchiveScreen({super.key});

  @override
  ConsumerState<ConversionArchiveScreen> createState() =>
      _ConversionArchiveScreenState();
}

class _ConversionArchiveScreenState
    extends ConsumerState<ConversionArchiveScreen> {
  String _expandedConversionId = '';

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final conversionsAsync = ref.watch(conversionHistoryStreamProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: buildBackground(colorScheme),
        child: SafeArea(
          bottom: false,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(AppTheme.spacingLg),
                child: Column(
                  children: [
                    _buildHeader(context),
                    const SizedBox(height: AppTheme.spacingMd),
                  ],
                ),
              ),
              Expanded(
                child: conversionsAsync.when(
                  data:
                      (conversions) =>
                          _buildConversionsList(context, conversions),
                  loading:
                      () => const Center(child: CircularProgressIndicator()),
                  error: (error, stack) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(AppTheme.spacingLg),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.error_outline_rounded,
                              size: 48,
                              color: colorScheme.error,
                            ),
                            const SizedBox(height: AppTheme.spacingMd),
                            SelectableText(
                              tr(
                                'error_loading_conversions',
                                args: {'error': error.toString()},
                              ),
                              style: TextStyle(
                                color: colorScheme.error,
                                fontFamily: AppTheme.defaultFontFamilyName,
                                fontSize: 14,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: AppTheme.spacingMd),
                            Text(
                              'Tap and hold to select and copy the error message',
                              style: TextStyle(
                                color: colorScheme.onSurface.withValues(
                                  alpha: 0.5,
                                ),
                                fontFamily: AppTheme.defaultFontFamilyName,
                                fontSize: 12,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Row(
      children: [
        IconButton(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.arrow_back_rounded),
          style: IconButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.surfaceContainerHigh,
          ),
        ),
        const SizedBox(width: AppTheme.spacingSm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                trad(context)!.conversion_archive,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: Theme.of(context).colorScheme.onSurface,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
              ),
              Text(
                trad(context)!.conversion_archive_subtitle,
                style: TextStyle(
                  fontSize: 14,
                  color: Theme.of(
                    context,
                  ).colorScheme.onSurface.withValues(alpha: 0.7),
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildConversionsList(
    BuildContext context,
    List<ConversionHistory> conversions,
  ) {
    if (conversions.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppTheme.spacingLg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.history_rounded,
                size: 80,
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.3),
              ),
              const SizedBox(height: AppTheme.spacingMd),
              Text(
                trad(context)!.no_conversions_yet,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(
                    context,
                  ).colorScheme.onSurface.withValues(alpha: 0.6),
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.only(
        left: AppTheme.spacingLg,
        right: AppTheme.spacingLg,
        bottom: AppTheme.spacingXxl * 3,
      ),
      physics: const BouncingScrollPhysics(),
      itemCount: conversions.length,
      itemBuilder: (context, index) {
        final conversion = conversions[index];
        final isExpanded = _expandedConversionId == conversion.id;
        return _buildConversionCard(context, conversion, isExpanded);
      },
    );
  }

  Widget _buildConversionCard(
    BuildContext context,
    ConversionHistory conversion,
    bool isExpanded,
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
              _expandedConversionId = isExpanded ? '' : conversion.id;
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
                      isExpanded
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                      color: colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ],
                ),
                if (isExpanded) ...[
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

    // Navigate back and to converter page
    Navigator.of(context).popUntil((route) => route.isFirst);
  }
}
