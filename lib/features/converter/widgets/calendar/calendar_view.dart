import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/utils/calendar_utils.dart';
import 'package:zadiag/features/converter/widgets/event_card.dart';
import 'calendar_header.dart';
import 'day_view.dart';
import 'month_view.dart';
import 'week_view.dart';

/// Main calendar view widget with view mode switching.
class CalendarView extends StatefulWidget {
  /// Events to display in the calendar
  final List<CalendarEvent> events;

  const CalendarView({super.key, required this.events});

  @override
  State<CalendarView> createState() => _CalendarViewState();
}

class _CalendarViewState extends State<CalendarView> {
  CalendarViewMode _viewMode = CalendarViewMode.month;
  DateTime _currentDate = DateTime.now();
  DateTime? _selectedDate;

  void _handleViewModeChanged(CalendarViewMode mode) {
    setState(() {
      _viewMode = mode;
    });
  }

  void _handlePrevious() {
    setState(() {
      switch (_viewMode) {
        case CalendarViewMode.month:
          _currentDate = CalendarUtils.previousMonth(_currentDate);
          break;
        case CalendarViewMode.week:
          _currentDate = CalendarUtils.previousWeek(_currentDate);
          break;
        case CalendarViewMode.day:
          _currentDate = CalendarUtils.previousDay(_currentDate);
          break;
      }
    });
  }

  void _handleNext() {
    setState(() {
      switch (_viewMode) {
        case CalendarViewMode.month:
          _currentDate = CalendarUtils.nextMonth(_currentDate);
          break;
        case CalendarViewMode.week:
          _currentDate = CalendarUtils.nextWeek(_currentDate);
          break;
        case CalendarViewMode.day:
          _currentDate = CalendarUtils.nextDay(_currentDate);
          break;
      }
    });
  }

  void _handleToday() {
    setState(() {
      _currentDate = DateTime.now();
    });
  }

  void _handleDayTapped(DateTime date) {
    setState(() {
      // Toggle selection - if same date is tapped, deselect it
      if (_selectedDate != null &&
          CalendarUtils.isSameDay(_selectedDate!, date)) {
        _selectedDate = null;
      } else {
        _selectedDate = date;
      }
    });
  }

  void _handleEventTapped(CalendarEvent event) {
    showDialog(
      context: context,
      builder: (context) => _buildEventDialog(event),
    );
  }

  @override
  Widget build(BuildContext context) {
    final selectedDayEvents =
        _selectedDate != null
            ? CalendarUtils.getEventsForDate(widget.events, _selectedDate!)
            : <CalendarEvent>[];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CalendarHeader(
          currentDate: _currentDate,
          viewMode: _viewMode,
          onViewModeChanged: _handleViewModeChanged,
          onPrevious: _handlePrevious,
          onNext: _handleNext,
          onToday: _handleToday,
        ),

        const SizedBox(height: AppTheme.spacingLg),

        // Calendar content
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          child: _buildCurrentView(),
        ),

        // Selected day events (month view only)
        if (_viewMode == CalendarViewMode.month && _selectedDate != null) ...[
          const SizedBox(height: AppTheme.spacingLg),
          _buildSelectedDayEvents(selectedDayEvents, _selectedDate!),
        ],
      ],
    );
  }

  Widget _buildCurrentView() {
    switch (_viewMode) {
      case CalendarViewMode.month:
        return MonthView(
          key: ValueKey('month_${_currentDate.month}_${_currentDate.year}'),
          displayMonth: _currentDate,
          events: widget.events,
          onDayTapped: _handleDayTapped,
        );
      case CalendarViewMode.week:
        return WeekView(
          key: ValueKey(
            'week_${_currentDate.day}_${_currentDate.month}_${_currentDate.year}',
          ),
          displayWeek: _currentDate,
          events: widget.events,
          onEventTapped: _handleEventTapped,
        );
      case CalendarViewMode.day:
        return DayView(
          key: ValueKey(
            'day_${_currentDate.day}_${_currentDate.month}_${_currentDate.year}',
          ),
          displayDay: _currentDate,
          events: widget.events,
          onEventTapped: _handleEventTapped,
        );
    }
  }

  Widget _buildSelectedDayEvents(List<CalendarEvent> dayEvents, DateTime date) {
    final colorScheme = Theme.of(context).colorScheme;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            child: Row(
              children: [
                Icon(Icons.event_rounded, color: colorScheme.primary, size: 20),
                const SizedBox(width: AppTheme.spacingSm),
                Expanded(
                  child: Text(
                    '${date.day}/${date.month}/${date.year} - ${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: colorScheme.onSurface,
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 20),
                  onPressed: () => setState(() => _selectedDate = null),
                  color: colorScheme.onSurface,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),

          // Event list
          if (dayEvents.isNotEmpty)
            ...dayEvents.map((event) {
              return Padding(
                padding: const EdgeInsets.only(
                  left: AppTheme.spacingMd,
                  right: AppTheme.spacingMd,
                  bottom: AppTheme.spacingSm,
                ),
                child: EventCard(event: event),
              );
            }),

          const SizedBox(height: AppTheme.spacingSm),
        ],
      ),
    );
  }

  Widget _buildEventDialog(CalendarEvent event) {
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
