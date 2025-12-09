import 'package:flutter/material.dart';

class DayGridBackground extends StatelessWidget {
  final double hourHeight;

  const DayGridBackground({super.key, required this.hourHeight});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    const hours = 24;

    return Container(
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(
            color: colorScheme.outline.withValues(alpha: 0.2),
            width: 1,
          ),
        ),
      ),
      child: Stack(
        children: List.generate(hours, (hour) {
          return Positioned(
            top: hour * hourHeight,
            left: 0,
            right: 0,
            child: Container(
              height: 1,
              color: colorScheme.outline.withValues(alpha: 0.15),
            ),
          );
        }),
      ),
    );
  }
}
