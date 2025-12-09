import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/utils/calendar_utils.dart';
import 'package:zadiag/features/converter/widgets/calendar/month_day_cell.dart';

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

  // Constants
  static const double _rowHeight = 52.0;

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

  void _onDaySelected(DateTime selectedDay, DateTime focusedDay) {
    // Also allow selecting empty days
    setState(() {
      _selectedDay = selectedDay;
      _focusedDay = focusedDay;
    });
    widget.onDayTapped?.call(selectedDay);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return TableCalendar<CalendarEvent>(
      firstDay: DateTime.utc(2020, 1, 1),
      lastDay: DateTime.utc(2030, 12, 31),
      focusedDay: _focusedDay,
      selectedDayPredicate:
          (day) =>
              _selectedDay != null &&
              CalendarUtils.isSameDay(day, _selectedDay!),
      eventLoader: _getEventsForDay,
      startingDayOfWeek: StartingDayOfWeek.monday,
      calendarFormat: CalendarFormat.month,
      availableCalendarFormats: const {CalendarFormat.month: 'Month'},
      headerVisible: false,
      rowHeight: _rowHeight,
      onDaySelected: _onDaySelected,
      onPageChanged: (focusedDay) {
        _focusedDay = focusedDay;
      },
      calendarStyle: CalendarStyle(
        // Cell decorations - simplified as we use custom builders mostly
        outsideDaysVisible: false,
        tableBorder: TableBorder.all(
          color: colorScheme.outlineVariant.withValues(alpha: 0.2),
          width: 0.5,
        ),
      ),
      daysOfWeekStyle: DaysOfWeekStyle(
        weekdayStyle: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: colorScheme.onSurface.withValues(alpha: 0.7),
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
        weekendStyle: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: colorScheme.onSurface.withValues(alpha: 0.5),
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
      ),
      calendarBuilders: CalendarBuilders(
        prioritizedBuilder: (context, day, focusedDay) {
          final isToday = CalendarUtils.isSameDay(day, DateTime.now());
          final isSelected =
              _selectedDay != null &&
              CalendarUtils.isSameDay(day, _selectedDay!);
          final events = _getEventsForDay(day);

          return MonthDayCell(
            day: day,
            events: events,
            isToday: isToday,
            isSelected: isSelected,
            // We don't pass onTap here, letting TableCalendar handle the tap
            // via onDaySelected.
          );
        },
      ),
    );
  }
}
