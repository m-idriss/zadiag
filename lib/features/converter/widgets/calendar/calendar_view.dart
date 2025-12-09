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
          duration: const Duration(milliseconds: 350),
          switchInCurve: Curves.easeInOut,
          switchOutCurve: Curves.easeInOut,
          transitionBuilder: (Widget child, Animation<double> animation) {
            return FadeTransition(
              opacity: animation,
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0.0, 0.05),
                  end: Offset.zero,
                ).animate(animation),
                child: child,
              ),
            );
          },
          child: widget.events.isEmpty
              ? _buildEmptyState(context)
              : _buildCurrentView(),
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
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            colorScheme.surfaceContainerHigh,
            colorScheme.surfaceContainerHigh.withValues(alpha: 0.7),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(
          color: colorScheme.outline.withValues(alpha: 0.2),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            decoration: BoxDecoration(
              color: colorScheme.primary.withValues(alpha: 0.05),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(AppTheme.radiusLg),
                topRight: Radius.circular(AppTheme.radiusLg),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.event_rounded,
                    color: colorScheme.primary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: AppTheme.spacingMd),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${date.day}/${date.month}/${date.year}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: colorScheme.onSurface,
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                      ),
                      Text(
                        '${dayEvents.length} event${dayEvents.length > 1 ? 's' : ''}',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: colorScheme.onSurface.withValues(alpha: 0.6),
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 22),
                  onPressed: () => setState(() => _selectedDate = null),
                  color: colorScheme.onSurface,
                  style: IconButton.styleFrom(
                    backgroundColor: colorScheme.surfaceContainerHigh,
                  ),
                ),
              ],
            ),
          ),

          // Event list
          if (dayEvents.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(AppTheme.spacingMd),
              child: Column(
                children: dayEvents.map((event) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: AppTheme.spacingSm),
                    child: EventCard(event: event),
                  );
                }).toList(),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.all(AppTheme.spacingXl),
              child: Center(
                child: Text(
                  'No events on this day',
                  style: TextStyle(
                    fontSize: 14,
                    color: colorScheme.onSurface.withValues(alpha: 0.5),
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ),
            ),
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

  Widget _buildEmptyState(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      key: const ValueKey('empty'),
      padding: const EdgeInsets.all(AppTheme.spacingXl * 2),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(
          color: colorScheme.outline.withValues(alpha: 0.1),
          width: 1,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.event_busy_rounded,
            size: 64,
            color: colorScheme.onSurface.withValues(alpha: 0.3),
          ),
          const SizedBox(height: AppTheme.spacingLg),
          Text(
            'No events to display',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: colorScheme.onSurface.withValues(alpha: 0.7),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
          const SizedBox(height: AppTheme.spacingSm),
          Text(
            'Add events to see them in the calendar',
            style: TextStyle(
              fontSize: 14,
              color: colorScheme.onSurface.withValues(alpha: 0.5),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
