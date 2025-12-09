import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/widgets/calendar/month_event_item.dart';

class MonthDayCell extends StatelessWidget {
  final DateTime day;
  final List<CalendarEvent> events;
  final bool isToday;
  final bool isSelected;
  final VoidCallback? onTap;

  const MonthDayCell({
    super.key,
    required this.day,
    required this.events,
    this.isToday = false,
    this.isSelected = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    final backgroundColor =
        isSelected
            ? colorScheme.primary.withValues(alpha: 0.1)
            : isToday
            ? colorScheme.surface
            : Colors.transparent;

    final borderColor =
        isSelected
            ? colorScheme.primary
            : isToday
            ? colorScheme.primary.withValues(alpha: 0.5)
            : Colors.transparent;

    // Determine max events to show based on logic or a constant
    // Previously hardcoded to 2 in the original file
    const int maxEventsVisible = 2;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.all(0),
        decoration: BoxDecoration(
          color: backgroundColor,
          border: Border.all(
            color: borderColor,
            width: isSelected ? 1.5 : (isToday ? 1.0 : 0.0),
          ),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Date Number Area
            Padding(
              padding: const EdgeInsets.only(top: 2, left: 3, right: 2),
              child: Text(
                '${day.day}',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight:
                      isToday || isSelected ? FontWeight.w700 : FontWeight.w500,
                  color:
                      isToday
                          ? colorScheme.primary
                          : colorScheme.onSurface.withValues(
                            alpha: isSelected ? 1.0 : 0.8,
                          ),
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
              ),
            ),

            if (events.isNotEmpty) ...[
              const SizedBox(height: 1),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Events list
                      ...events
                          .take(maxEventsVisible)
                          .map(
                            (event) => MonthEventItem(
                              event: event,
                              isSelected: isSelected,
                            ),
                          ),

                      // Overflow indicator
                      if (events.length > maxEventsVisible)
                        Padding(
                          padding: const EdgeInsets.only(top: 1, left: 1),
                          child: Text(
                            '+${events.length - maxEventsVisible}',
                            style: TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w600,
                              color: colorScheme.onSurface.withValues(
                                alpha: 0.6,
                              ),
                              fontFamily: AppTheme.defaultFontFamilyName,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
