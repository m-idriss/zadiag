import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/utils/calendar_utils.dart';

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
      rowHeight: 52, // Reduced row height for density
      onDaySelected: (selectedDay, focusedDay) {
        // Also allow selecting empty days
        setState(() {
          _selectedDay = selectedDay;
          _focusedDay = focusedDay;
        });
        widget.onDayTapped?.call(selectedDay);
      },
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

          return _buildCell(context, day, events, isToday, isSelected);
        },
      ),
    );
  }

  Widget _buildCell(
    BuildContext context,
    DateTime day,
    List<CalendarEvent> events,
    bool isToday,
    bool isSelected,
  ) {
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

    return Container(
      margin: const EdgeInsets.all(0), // Removed margin
      decoration: BoxDecoration(
        color: backgroundColor,
        border: Border.all(
          color: borderColor,
          width: isSelected ? 1.5 : (isToday ? 1.0 : 0.0),
        ),
        borderRadius: BorderRadius.circular(2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Date Number
          Padding(
            padding: const EdgeInsets.only(top: 1, left: 2, right: 1),
            child: Text(
              '${day.day}',
              style: TextStyle(
                fontSize: 10,
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
                padding: const EdgeInsets.symmetric(horizontal: 1),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Show up to 4 events if they fit
                    ...events
                        .take(4)
                        .map(
                          (event) =>
                              _buildEventItem(context, event, isSelected),
                        ),

                    // Overflow indicator
                    if (events.length > 4)
                      Padding(
                        padding: const EdgeInsets.only(top: 0, left: 1),
                        child: Text(
                          '+${events.length - 4}',
                          style: TextStyle(
                            fontSize: 7,
                            fontWeight: FontWeight.w600,
                            color: colorScheme.onSurface.withValues(alpha: 0.5),
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
    );
  }

  Widget _buildEventItem(
    BuildContext context,
    CalendarEvent event,
    bool isSelected,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.only(bottom: 1),
      padding: const EdgeInsets.symmetric(horizontal: 1, vertical: 0.5),
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer.withValues(
          alpha: isSelected ? 0.7 : 0.5,
        ),
        borderRadius: BorderRadius.circular(1.5),
      ),
      child: Text(
        event.title,
        style: TextStyle(
          fontSize: 7.5,
          fontWeight: FontWeight.w500,
          color: colorScheme.onPrimaryContainer,
          fontFamily: AppTheme.defaultFontFamilyName,
          height: 1.0,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}
