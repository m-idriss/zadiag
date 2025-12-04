import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/utils/calendar_utils.dart';

/// Week view showing events in a timeline grid.
class WeekView extends StatelessWidget {
  /// The week to display (any date in the week)
  final DateTime displayWeek;

  /// Events to display
  final List<CalendarEvent> events;

  /// Callback when an event is tapped
  final ValueChanged<CalendarEvent>? onEventTapped;

  const WeekView({
    super.key,
    required this.displayWeek,
    required this.events,
    this.onEventTapped,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final weekDates = CalendarUtils.generateWeekDates(displayWeek);

    return Column(
      children: [
        // Day headers
        _buildDayHeaders(context, weekDates, colorScheme),
        const SizedBox(height: AppTheme.spacingSm),

        // Timeline
        SizedBox(
          height: 600,
          child: SingleChildScrollView(
            child: _buildTimeline(context, weekDates, colorScheme),
          ),
        ),
      ],
    );
  }

  Widget _buildDayHeaders(
    BuildContext context,
    List<DateTime> weekDates,
    ColorScheme colorScheme,
  ) {
    return Row(
      children: [
        // Time column spacer
        const SizedBox(width: 50),

        // Day headers
        ...weekDates.map((date) {
          final isToday = CalendarUtils.isToday(date);

          return Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingSm),
              decoration: BoxDecoration(
                color:
                    isToday
                        ? colorScheme.primary.withValues(alpha: 0.1)
                        : Colors.transparent,
                borderRadius: BorderRadius.circular(AppTheme.radiusSm),
              ),
              child: Column(
                children: [
                  Text(
                    DateFormat('EEE').format(date),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    date.day.toString(),
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: isToday ? FontWeight.w700 : FontWeight.w600,
                      color:
                          isToday ? colorScheme.primary : colorScheme.onSurface,
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildTimeline(
    BuildContext context,
    List<DateTime> weekDates,
    ColorScheme colorScheme,
  ) {
    const hourHeight = 60.0;
    const hours = 24;

    return SizedBox(
      height: hourHeight * hours,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Time labels
          SizedBox(
            width: 50,
            child: Column(
              children: List.generate(hours, (hour) {
                return SizedBox(
                  height: hourHeight,
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: Text(
                      '${hour.toString().padLeft(2, '0')}:00',
                      style: TextStyle(
                        fontSize: 10,
                        color: colorScheme.onSurface.withValues(alpha: 0.5),
                        fontFamily: AppTheme.defaultFontFamilyName,
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),

          // Day columns
          ...weekDates.map((date) {
            return Expanded(
              child: _buildDayColumn(context, date, hourHeight, colorScheme),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildDayColumn(
    BuildContext context,
    DateTime date,
    double hourHeight,
    ColorScheme colorScheme,
  ) {
    final dayEvents = CalendarUtils.getEventsForDate(events, date);
    final sortedEvents = CalendarUtils.sortEventsByTime(dayEvents);
    final layouts = CalendarUtils.layoutOverlappingEvents(sortedEvents);

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
        children: [
          // Hour dividers
          ...List.generate(24, (hour) {
            return Positioned(
              top: hour * hourHeight,
              left: 0,
              right: 0,
              child: Container(
                height: 1,
                color: colorScheme.outline.withValues(alpha: 0.1),
              ),
            );
          }),

          // Events
          ...layouts.map((layout) {
            final event = layout['event'] as CalendarEvent;
            final position = CalendarUtils.calculateEventPosition(event);
            final column = layout['column'] as int;
            final totalColumns = layout['totalColumns'] as int;

            final widthFraction = 1.0 / totalColumns;
            final leftFraction = column / totalColumns;

            return Positioned(
              top: position['top']! * hourHeight * 24,
              height: position['height']! * hourHeight * 24,
              left: leftFraction * 100,
              right: (1 - leftFraction - widthFraction) * 100,
              child: GestureDetector(
                onTap: () => onEventTapped?.call(event),
                child: Container(
                  margin: const EdgeInsets.only(right: 2, bottom: 2),
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: colorScheme.primary.withValues(alpha: 0.4),
                      width: 1,
                    ),
                  ),
                  child: OverflowBox(
                    maxHeight: double.infinity,
                    alignment: Alignment.topLeft,
                    child: Text(
                      event.title,
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w600,
                        color: colorScheme.onSurface,
                        fontFamily: AppTheme.defaultFontFamilyName,
                        height: 1.1,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
