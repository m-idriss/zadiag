import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

class DayTimeLabels extends StatelessWidget {
  final double hourHeight;

  const DayTimeLabels({super.key, required this.hourHeight});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    const hours = 24;

    return SizedBox(
      width: 40,
      child: Column(
        children: List.generate(hours, (hour) {
          return SizedBox(
            height: hourHeight,
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(right: 6, top: 2),
                child: Text(
                  '${hour.toString().padLeft(2, '0')}:00',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                    color: colorScheme.onSurface.withValues(alpha: 0.5),
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
