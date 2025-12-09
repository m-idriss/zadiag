import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';

class MonthEventItem extends StatelessWidget {
  final CalendarEvent event;
  final bool isSelected;
  final VoidCallback? onTap;

  const MonthEventItem({
    super.key,
    required this.event,
    required this.isSelected,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 1),
        padding: const EdgeInsets.symmetric(horizontal: 1.5, vertical: 0.5),
        decoration: BoxDecoration(
          color: colorScheme.primaryContainer.withValues(
            alpha: isSelected ? 0.8 : 0.6,
          ),
          borderRadius: BorderRadius.circular(2),
        ),
        child: Text(
          event.title,
          style: TextStyle(
            fontSize: 8,
            fontWeight: FontWeight.w500,
            color: colorScheme.onPrimaryContainer,
            fontFamily: AppTheme.defaultFontFamilyName,
            height: 1.1,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }
}
