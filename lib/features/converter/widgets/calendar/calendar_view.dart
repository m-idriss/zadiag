import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/utils/calendar_utils.dart';
import 'calendar_header.dart';
import 'day_view.dart';
import 'month_view.dart';
import 'week_view.dart';

/// Main calendar view widget with view mode switching.
/// Main calendar view widget with view mode switching.
class CalendarView extends StatelessWidget {
  /// Events to display in the calendar
  final List<CalendarEvent> events;

  /// Current view mode
  final CalendarViewMode viewMode;

  /// Currently focused date
  final DateTime focusedDate;

  /// Currently selected date (for filtering)
  final DateTime? selectedDate;

  /// Callback when view mode changes
  final ValueChanged<CalendarViewMode> onViewModeChanged;

  /// Callback when focused date changes
  final ValueChanged<DateTime> onFocusedDateChanged;

  /// Callback when a day is selected
  final ValueChanged<DateTime?> onSelectedDateChanged;

  const CalendarView({
    super.key,
    required this.events,
    required this.viewMode,
    required this.focusedDate,
    required this.selectedDate,
    required this.onViewModeChanged,
    required this.onFocusedDateChanged,
    required this.onSelectedDateChanged,
  });

  void _handlePrevious() {
    switch (viewMode) {
      case CalendarViewMode.month:
        onFocusedDateChanged(CalendarUtils.previousMonth(focusedDate));
        break;
      case CalendarViewMode.week:
        onFocusedDateChanged(CalendarUtils.previousWeek(focusedDate));
        break;
      case CalendarViewMode.day:
        onFocusedDateChanged(CalendarUtils.previousDay(focusedDate));
        break;
    }
  }

  void _handleNext() {
    switch (viewMode) {
      case CalendarViewMode.month:
        onFocusedDateChanged(CalendarUtils.nextMonth(focusedDate));
        break;
      case CalendarViewMode.week:
        onFocusedDateChanged(CalendarUtils.nextWeek(focusedDate));
        break;
      case CalendarViewMode.day:
        onFocusedDateChanged(CalendarUtils.nextDay(focusedDate));
        break;
    }
  }

  void _handleToday() {
    onFocusedDateChanged(DateTime.now());
  }

  void _handleDayTapped(DateTime date) {
    // Toggle selection - if same date is tapped, deselect it
    if (selectedDate != null && CalendarUtils.isSameDay(selectedDate!, date)) {
      onSelectedDateChanged(null);
    } else {
      onSelectedDateChanged(date);
    }
  }

  void _handleEventTapped(BuildContext context, CalendarEvent event) {
    showDialog(
      context: context,
      builder: (context) => _buildEventDialog(context, event),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CalendarHeader(
          currentDate: focusedDate,
          viewMode: viewMode,
          onViewModeChanged: onViewModeChanged,
          onPrevious: _handlePrevious,
          onNext: _handleNext,
          onToday: _handleToday,
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Calendar content
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          child: _buildCurrentView(context),
        ),
      ],
    );
  }

  Widget _buildCurrentView(BuildContext context) {
    switch (viewMode) {
      case CalendarViewMode.month:
        return MonthView(
          key: ValueKey('month_${focusedDate.month}_${focusedDate.year}'),
          displayMonth: focusedDate,
          events: events,
          onDayTapped: _handleDayTapped,
        );
      case CalendarViewMode.week:
        return WeekView(
          key: ValueKey(
            'week_${focusedDate.day}_${focusedDate.month}_${focusedDate.year}',
          ),
          displayWeek: focusedDate,
          events: events,
          onEventTapped: (event) => _handleEventTapped(context, event),
        );
      case CalendarViewMode.day:
        return DayView(
          key: ValueKey(
            'day_${focusedDate.day}_${focusedDate.month}_${focusedDate.year}',
          ),
          displayDay: focusedDate,
          events: events,
          onEventTapped: (event) => _handleEventTapped(context, event),
        );
    }
  }

  Widget _buildEventDialog(BuildContext context, CalendarEvent event) {
    final colorScheme = Theme.of(context).colorScheme;

    return AlertDialog(
      title: Text(
        event.title,
        style: TextStyle(
          fontWeight: FontWeight.w700,
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (event.description != null && event.description!.isNotEmpty) ...[
            Text(
              event.description!,
              style: TextStyle(
                fontSize: 14,
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
            const SizedBox(height: AppTheme.spacingMd),
          ],

          _buildInfoRow(
            Icons.access_time_rounded,
            event.isAllDay
                ? 'All day'
                : '${event.startDateTime.hour}:${event.startDateTime.minute.toString().padLeft(2, '0')} - ${event.endDateTime.hour}:${event.endDateTime.minute.toString().padLeft(2, '0')}',
            colorScheme,
          ),

          if (event.location != null && event.location!.isNotEmpty)
            _buildInfoRow(
              Icons.location_on_rounded,
              event.location!,
              colorScheme,
            ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(
            'Close',
            style: TextStyle(fontFamily: AppTheme.defaultFontFamilyName),
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow(IconData icon, String text, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingSm),
      child: Row(
        children: [
          Icon(icon, size: 16, color: colorScheme.primary),
          const SizedBox(width: AppTheme.spacingSm),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13,
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
