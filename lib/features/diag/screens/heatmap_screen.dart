import 'package:flutter/material.dart';
import 'package:flutter_heatmap_calendar/flutter_heatmap_calendar.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/constants/app_theme.dart';

class HeatMapScreen extends StatefulWidget {
  const HeatMapScreen({super.key});

  @override
  State<HeatMapScreen> createState() => _HeatMapScreenState();
}

class _HeatMapScreenState extends State<HeatMapScreen> {
  final TextEditingController heatLevelController = TextEditingController();
  Map<DateTime, int> heatMapDatasets = {};
  DateTime? endDate = DateTime.now();
  DateTime? startDate = DateTime.now().subtract(const Duration(days: 90));

  @override
  void dispose() {
    heatLevelController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    heatMapDatasets = generateRandomHeatMapData();
  }

  @override
  Widget build(BuildContext context) {
    final defaultColorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: _background(defaultColorScheme),
        child: SafeArea(
          child: ListView(
            padding: EdgeInsets.all(AppTheme.spacingLg),
            physics: const BouncingScrollPhysics(),
            children: [
              _header(context),
              const SizedBox(height: AppTheme.spacingLg),
              _heatMapCard(context),
              const SizedBox(height: AppTheme.spacingMd),
              _legendCard(context),
            ],
          ),
        ),
      ),
    );
  }

  BoxDecoration _background(ColorScheme colorScheme) {
    return buildBackground(colorScheme);
  }

  Column _header(BuildContext context) {
    return buildHeader(
      context,
      trad(context)!.activity_tracking,
      trad(context)!.activity_tracking_subtitle,
    );
  }

  Widget _heatMapCard(BuildContext context) {
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
            DateTime date = DateTime.parse(value.toString());
            String formattedDate = '${date.day}/${date.month}/${date.year}';
            String dayOfWeek = buildDayOfWeek(context, date.weekday - 1);
            formattedDate = '$dayOfWeek $formattedDate';
            showSnackBar(context, formattedDate);
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
            'Less',
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
          const SizedBox(width: AppTheme.spacingSm),
          ...List.generate(5, (index) {
            return Container(
              width: 16,
              height: 16,
              margin: EdgeInsets.symmetric(horizontal: 2),
              decoration: BoxDecoration(
                color: index == 0
                    ? Theme.of(context).colorScheme.surfaceContainerHigh
                    : Theme.of(context).colorScheme.secondary.withValues(
                          alpha: 0.25 + (index * 0.2),
                        ),
                borderRadius: BorderRadius.circular(4),
              ),
            );
          }),
          const SizedBox(width: AppTheme.spacingSm),
          Text(
            'More',
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
        ],
      ),
    );
  }
}
