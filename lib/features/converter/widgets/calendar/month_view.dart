import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/utils/calendar_utils.dart';
import 'calendar_event_cell.dart';

/// Month view calendar using table_calendar package showing events as dots.
class MonthView extends StatefulWidget {
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
  State<MonthView> createState() => _MonthViewState();
}

class _MonthViewState extends State<MonthView> {
  late DateTime _focusedDay;
  DateTime? _selectedDay;

  @override
  void initState() {
    super.initState();
    _focusedDay = widget.displayMonth;
  }

  @override
  void didUpdateWidget(MonthView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.displayMonth != oldWidget.displayMonth) {
      _focusedDay = widget.displayMonth;
    }
  }

  List<CalendarEvent> _getEventsForDay(DateTime day) {
    return CalendarUtils.getEventsForDate(widget.events, day);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final groupedEvents = CalendarUtils.groupEventsByDate(widget.events);

    return TableCalendar<CalendarEvent>(
      firstDay: DateTime.utc(2020, 1, 1),
      lastDay: DateTime.utc(2030, 12, 31),
      focusedDay: _focusedDay,
      selectedDayPredicate: (day) => _selectedDay != null && CalendarUtils.isSameDay(day, _selectedDay!),
      eventLoader: _getEventsForDay,
      startingDayOfWeek: StartingDayOfWeek.monday,
      calendarFormat: CalendarFormat.month,
      availableCalendarFormats: const {CalendarFormat.month: 'Month'},
      headerVisible: false,
      onDaySelected: (selectedDay, focusedDay) {
        final events = _getEventsForDay(selectedDay);
        if (events.isNotEmpty) {
          setState(() {
            _selectedDay = selectedDay;
            _focusedDay = focusedDay;
          });
          widget.onDayTapped?.call(selectedDay);
        }
      },
      onPageChanged: (focusedDay) {
        _focusedDay = focusedDay;
      },
      calendarStyle: CalendarStyle(
        // Cell decorations
        defaultDecoration: BoxDecoration(
          color: colorScheme.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        ),
        todayDecoration: BoxDecoration(
          color: colorScheme.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(
            color: colorScheme.primary.withValues(alpha: 0.5),
            width: 1.5,
          ),
        ),
        selectedDecoration: BoxDecoration(
          color: colorScheme.primary.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(
            color: colorScheme.primary,
            width: 2.0,
          ),
        ),
        outsideDecoration: BoxDecoration(
          color: colorScheme.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        ),
        
        // Text styles
        defaultTextStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: colorScheme.onSurface,
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
        todayTextStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: colorScheme.primary,
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
        selectedTextStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: colorScheme.primary,
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
        outsideTextStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: colorScheme.onSurface.withValues(alpha: 0.3),
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
        weekendTextStyle: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: colorScheme.onSurface,
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
        
        // Spacing
        cellMargin: const EdgeInsets.all(2),
        cellPadding: const EdgeInsets.all(0),
        
        // Markers (event indicators)
        markersMaxCount: 3,
        markerDecoration: BoxDecoration(
          color: colorScheme.primary,
          shape: BoxShape.circle,
        ),
        markerSize: 6.0,
        markerMargin: const EdgeInsets.symmetric(horizontal: 1.0, vertical: 2.0),
        markersAlignment: Alignment.bottomCenter,
      ),
      daysOfWeekStyle: DaysOfWeekStyle(
        weekdayStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: colorScheme.onSurface.withValues(alpha: 0.5),
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
        weekendStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: colorScheme.onSurface.withValues(alpha: 0.5),
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
      ),
      calendarBuilders: CalendarBuilders(
        // Custom marker builder to show "+N" for overflow events
        markerBuilder: (context, date, events) {
          if (events.isEmpty) return const SizedBox();
          
          final eventsList = events.cast<CalendarEvent>();
          const maxDots = 3;
          final visibleEvents = eventsList.take(maxDots).toList();
          final remainingCount = eventsList.length - visibleEvents.length;
          
          return Positioned(
            bottom: 2,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Event dots
                ...visibleEvents.map((event) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 1.0),
                    child: EventIndicatorDot(color: colorScheme.primary),
                  );
                }),
                // "+N more" indicator
                if (remainingCount > 0)
                  Padding(
                    padding: const EdgeInsets.only(left: 2),
                    child: Text(
                      '+$remainingCount',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        color: colorScheme.onSurface.withValues(alpha: 0.5),
                        fontFamily: AppTheme.defaultFontFamilyName,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
