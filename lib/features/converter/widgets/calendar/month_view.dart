import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/utils/calendar_utils.dart';
import 'calendar_event_cell.dart';

/// Month view calendar grid showing events as dots.
class MonthView extends StatelessWidget {
  /// The month to display
  final DateTime displayMonth;

  /// Events to display
  final List<CalendarEvent> events;

  /// Callback when a day is tapped
  final ValueChanged<DateTime>? onDayTapped;

  const MonthView({
    super.key,
    required this.displayMonth,
    required this.events,
    this.onDayTapped,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final monthGrid = CalendarUtils.generateMonthGrid(displayMonth);
    final groupedEvents = CalendarUtils.groupEventsByDate(events);

    return Column(
      children: [
        // Weekday headers
        _buildWeekdayHeaders(context, colorScheme),
        const SizedBox(height: AppTheme.spacingSm),

        // Calendar grid
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            childAspectRatio: 1.0,
            crossAxisSpacing: 4,
            mainAxisSpacing: 4,
          ),
          itemCount: 42,
          itemBuilder: (context, index) {
            final date = monthGrid[index];
            final dayEvents =
                groupedEvents[DateTime(date.year, date.month, date.day)] ?? [];

            return _buildDayCell(
              context,
              date: date,
              events: dayEvents,
              isCurrentMonth: CalendarUtils.isCurrentMonth(date, displayMonth),
              isToday: CalendarUtils.isToday(date),
              colorScheme: colorScheme,
            );
          },
        ),
      ],
    );
  }

  Widget _buildWeekdayHeaders(BuildContext context, ColorScheme colorScheme) {
    final weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return Row(
      children:
          weekdays.map((day) {
            return Expanded(
              child: Center(
                child: Text(
                  day,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSurface.withValues(alpha: 0.5),
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ),
            );
          }).toList(),
    );
  }

  Widget _buildDayCell(
    BuildContext context, {
    required DateTime date,
    required List<CalendarEvent> events,
    required bool isCurrentMonth,
    required bool isToday,
    required ColorScheme colorScheme,
  }) {
    final dayNumber = date.day;

    return GestureDetector(
      onTap: events.isNotEmpty ? () => onDayTapped?.call(date) : null,
      child: Container(
        decoration: BoxDecoration(
          color:
              isToday
                  ? colorScheme.primary.withValues(alpha: 0.1)
                  : colorScheme.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border:
              isToday
                  ? Border.all(
                    color: colorScheme.primary.withValues(alpha: 0.5),
                    width: 1.5,
                  )
                  : null,
        ),
        child: ClipRect(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 2),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Day number
                Text(
                  dayNumber.toString(),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
                    color:
                        isCurrentMonth
                            ? (isToday
                                ? colorScheme.primary
                                : colorScheme.onSurface)
                            : colorScheme.onSurface.withValues(alpha: 0.3),
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),

                const SizedBox(height: 2),

                // Event indicators
                if (events.isNotEmpty)
                  Flexible(
                    child: _buildEventIndicators(context, events, colorScheme),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEventIndicators(
    BuildContext context,
    List<CalendarEvent> events,
    ColorScheme colorScheme,
  ) {
    const maxDots = 3;
    final visibleEvents = events.take(maxDots).toList();
    final remainingCount = events.length - visibleEvents.length;

    return Column(
      children: [
        // Event dots
        Wrap(
          spacing: 2,
          runSpacing: 2,
          alignment: WrapAlignment.center,
          children:
              visibleEvents.map((event) {
                return EventIndicatorDot(color: colorScheme.primary);
              }).toList(),
        ),

        // "+N more" indicator
        if (remainingCount > 0) ...[
          const SizedBox(height: 2),
          Text(
            '+$remainingCount',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: colorScheme.onSurface.withValues(alpha: 0.5),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
        ],
      ],
    );
  }
}
