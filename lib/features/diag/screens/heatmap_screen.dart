import 'package:flutter/material.dart';
import 'package:flutter_heatmap_calendar/flutter_heatmap_calendar.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';

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
        padding: const EdgeInsets.all(22),
        decoration: _background(defaultColorScheme),
        child: ListView(
          children: [
            _header(context),
            const SizedBox(height: 12),
            _heatMap(context),
          ],
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

  Container _heatMap(BuildContext context) {
    return Container(
      height: 250,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary.withAlpha(20),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: Theme.of(context).colorScheme.primary.withAlpha(50),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(1),
        child: Card(
          color: Theme.of(context).colorScheme.tertiary,
          child: HeatMap(
            scrollable: true,
            colorMode: ColorMode.opacity,
            defaultColor: Theme.of(context).colorScheme.tertiary,
            textColor: Theme.of(context).colorScheme.primary,
            datasets: heatMapDatasets,
            size: 24,
            colorTipCount: 5,
            colorTipSize: 14,
            showColorTip: false,
            colorsets: {1: Theme.of(context).colorScheme.onTertiary},
            onClick: (value) {
              DateTime date = DateTime.parse(value.toString());
              String formattedDate = '${date.day}/${date.month}/${date.year}';
              String dayOfWeek = buildDayOfWeek(context, date.weekday - 1);
              formattedDate = '$dayOfWeek $formattedDate';
              showSnackBar(context, formattedDate);
            },
          ),
        ),
      ),
    );
  }
}
