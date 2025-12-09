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
            childAspectRatio: 1.1,
            crossAxisSpacing: 6,
            mainAxisSpacing: 6,
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

    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingSm),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      child: Row(
        children:
            weekdays.map((day) {
              return Expanded(
                child: Center(
                  child: Text(
                    day,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: colorScheme.onSurface.withValues(alpha: 0.7),
                      fontFamily: AppTheme.defaultFontFamilyName,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              );
            }).toList(),
      ),
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
    final hasEvents = events.isNotEmpty;

    return MouseRegion(
      cursor: hasEvents ? SystemMouseCursors.click : SystemMouseCursors.basic,
      child: GestureDetector(
        onTap: hasEvents ? () => onDayTapped?.call(date) : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color:
                isToday
                    ? colorScheme.primary.withValues(alpha: 0.15)
                    : (hasEvents
                        ? colorScheme.surfaceContainerHigh
                        : colorScheme.surfaceContainerHigh.withValues(alpha: 0.5)),
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            border:
                isToday
                    ? Border.all(
                      color: colorScheme.primary,
                      width: 2.0,
                    )
                    : (hasEvents
                        ? Border.all(
                          color: colorScheme.outline.withValues(alpha: 0.2),
                          width: 1.0,
                        )
                        : null),
            boxShadow:
                isToday
                    ? [
                      BoxShadow(
                        color: colorScheme.primary.withValues(alpha: 0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                    : null,
          ),
          child: ClipRect(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Day number
                  Text(
                    dayNumber.toString(),
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                      color:
                          isCurrentMonth
                              ? (isToday
                                  ? colorScheme.primary
                                  : colorScheme.onSurface)
                              : colorScheme.onSurface.withValues(alpha: 0.3),
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),

                  const SizedBox(height: 3),

                  // Event indicators
                  if (hasEvents)
                    Flexible(
                      child: _buildEventIndicators(context, events, colorScheme),
                    ),
                ],
              ),
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
      mainAxisSize: MainAxisSize.min,
      children: [
        // Event dots
        Wrap(
          spacing: 3,
          runSpacing: 3,
          alignment: WrapAlignment.center,
          children:
              visibleEvents.map((event) {
                return EventIndicatorDot(
                  color: colorScheme.primary,
                  size: 6,
                );
              }).toList(),
        ),

        // "+N more" indicator
        if (remainingCount > 0) ...[
          const SizedBox(height: 3),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: colorScheme.primary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              '+$remainingCount',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: colorScheme.primary,
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
