import 'package:zadiag/features/converter/models/calendar_event.dart';

/// Utility functions for calendar operations and date calculations.
class CalendarUtils {
  /// Gets the first day of the month for a given date.
  static DateTime getFirstDayOfMonth(DateTime date) {
    return DateTime(date.year, date.month, 1);
  }

  /// Gets the last day of the month for a given date.
  static DateTime getLastDayOfMonth(DateTime date) {
    return DateTime(date.year, date.month + 1, 0);
  }

  /// Gets the first day of the week for a given date.
  static DateTime getFirstDayOfWeek(DateTime date) {
    // Start week on Monday (weekday = 1)
    final daysToSubtract = date.weekday - 1;
    return DateTime(date.year, date.month, date.day - daysToSubtract);
  }

  /// Gets the last day of the week for a given date.
  static DateTime getLastDayOfWeek(DateTime date) {
    final firstDay = getFirstDayOfWeek(date);
    return firstDay.add(const Duration(days: 6));
  }

  /// Generates a list of dates for the calendar grid of a given month.
  /// Includes days from previous and next month to fill the grid.
  static List<DateTime> generateMonthGrid(DateTime date) {
    final firstDayOfMonth = getFirstDayOfMonth(date);

    // Get the first Monday before or on the first day of the month
    final gridStart = getFirstDayOfWeek(firstDayOfMonth);

    // Calculate how many weeks we need (usually 5-6 weeks)
    final daysInGrid = <DateTime>[];
    var currentDate = gridStart;

    // Generate 42 days (6 weeks) to ensure consistent grid size
    for (var i = 0; i < 42; i++) {
      daysInGrid.add(currentDate);
      currentDate = currentDate.add(const Duration(days: 1));
    }

    return daysInGrid;
  }

  /// Generates a list of dates for a week view.
  static List<DateTime> generateWeekDates(DateTime date) {
    final firstDay = getFirstDayOfWeek(date);
    final weekDates = <DateTime>[];

    for (var i = 0; i < 7; i++) {
      weekDates.add(firstDay.add(Duration(days: i)));
    }

    return weekDates;
  }

  /// Groups events by date (ignoring time).
  static Map<DateTime, List<CalendarEvent>> groupEventsByDate(
    List<CalendarEvent> events,
  ) {
    final grouped = <DateTime, List<CalendarEvent>>{};

    for (final event in events) {
      final dateKey = DateTime(
        event.startDateTime.year,
        event.startDateTime.month,
        event.startDateTime.day,
      );

      if (!grouped.containsKey(dateKey)) {
        grouped[dateKey] = [];
      }
      grouped[dateKey]!.add(event);
    }

    return grouped;
  }

  /// Gets events for a specific date.
  static List<CalendarEvent> getEventsForDate(
    List<CalendarEvent> events,
    DateTime date,
  ) {
    final targetDate = DateTime(date.year, date.month, date.day);

    return events.where((event) {
      final eventDate = DateTime(
        event.startDateTime.year,
        event.startDateTime.month,
        event.startDateTime.day,
      );
      return eventDate == targetDate;
    }).toList();
  }

  /// Gets events for a date range.
  static List<CalendarEvent> getEventsInRange(
    List<CalendarEvent> events,
    DateTime startDate,
    DateTime endDate,
  ) {
    return events.where((event) {
      return event.startDateTime.isAfter(startDate) &&
          event.startDateTime.isBefore(endDate);
    }).toList();
  }

  /// Gets events for the week of the given date.
  static List<CalendarEvent> getEventsForWeek(
    List<CalendarEvent> events,
    DateTime date,
  ) {
    final startOfWeek = getFirstDayOfWeek(date);
    final endOfWeek = getLastDayOfWeek(
      date,
    ).add(const Duration(days: 1)); // Include end of the day
    return getEventsInRange(events, startOfWeek, endOfWeek);
  }

  /// Checks if two dates are the same day.
  static bool isSameDay(DateTime date1, DateTime date2) {
    return date1.year == date2.year &&
        date1.month == date2.month &&
        date1.day == date2.day;
  }

  /// Checks if a date is today.
  static bool isToday(DateTime date) {
    final now = DateTime.now();
    return isSameDay(date, now);
  }

  /// Checks if a date is in the current month.
  static bool isCurrentMonth(DateTime date, DateTime referenceDate) {
    return date.year == referenceDate.year && date.month == referenceDate.month;
  }

  /// Navigates to the next month.
  static DateTime nextMonth(DateTime date) {
    if (date.month == 12) {
      return DateTime(date.year + 1, 1, 1);
    } else {
      return DateTime(date.year, date.month + 1, 1);
    }
  }

  /// Navigates to the previous month.
  static DateTime previousMonth(DateTime date) {
    if (date.month == 1) {
      return DateTime(date.year - 1, 12, 1);
    } else {
      return DateTime(date.year, date.month - 1, 1);
    }
  }

  /// Navigates to the next week.
  static DateTime nextWeek(DateTime date) {
    return date.add(const Duration(days: 7));
  }

  /// Navigates to the previous week.
  static DateTime previousWeek(DateTime date) {
    return date.subtract(const Duration(days: 7));
  }

  /// Navigates to the next day.
  static DateTime nextDay(DateTime date) {
    return date.add(const Duration(days: 1));
  }

  /// Navigates to the previous day.
  static DateTime previousDay(DateTime date) {
    return date.subtract(const Duration(days: 1));
  }

  /// Calculates the position and height of an event in a timeline view.
  /// Returns a map with 'top' (0-1) and 'height' (0-1) as fractions of the day.
  static Map<String, double> calculateEventPosition(CalendarEvent event) {
    const minutesInDay = 24 * 60;

    final startMinutes =
        event.startDateTime.hour * 60 + event.startDateTime.minute;
    final endMinutes = event.endDateTime.hour * 60 + event.endDateTime.minute;

    final top = startMinutes / minutesInDay;
    final height = (endMinutes - startMinutes) / minutesInDay;

    return {
      'top': top,
      'height': height.clamp(0.02, 1.0), // Minimum 2% height for visibility
    };
  }

  /// Sorts events by start time.
  static List<CalendarEvent> sortEventsByTime(List<CalendarEvent> events) {
    final sorted = List<CalendarEvent>.from(events);
    sorted.sort((a, b) => a.startDateTime.compareTo(b.startDateTime));
    return sorted;
  }

  /// Detects overlapping events and calculates their horizontal positions.
  /// Returns a list of maps with event and position info (left, width).
  static List<Map<String, dynamic>> layoutOverlappingEvents(
    List<CalendarEvent> events,
  ) {
    if (events.isEmpty) return [];

    final sorted = sortEventsByTime(events);
    final layouts = <Map<String, dynamic>>[];

    // Simple algorithm: check each event against previous ones
    for (var i = 0; i < sorted.length; i++) {
      final event = sorted[i];
      var column = 0;
      var maxColumn = 0;

      // Find which column this event should be in
      for (var j = 0; j < i; j++) {
        final otherEvent = sorted[j];
        if (_eventsOverlap(event, otherEvent)) {
          final otherLayout = layouts[j];
          if (otherLayout['column'] == column) {
            column++;
          }
          if (otherLayout['column'] > maxColumn) {
            maxColumn = otherLayout['column'];
          }
        }
      }

      final totalColumns = maxColumn + 1;
      layouts.add({
        'event': event,
        'column': column,
        'totalColumns': totalColumns > column ? totalColumns : column + 1,
      });
    }

    // Update all events in the same group with the max column count
    for (var i = 0; i < layouts.length; i++) {
      var maxCols = layouts[i]['totalColumns'] as int;
      for (var j = 0; j < layouts.length; j++) {
        if (i != j &&
            _eventsOverlap(layouts[i]['event'], layouts[j]['event'])) {
          maxCols =
              maxCols > (layouts[j]['totalColumns'] as int)
                  ? maxCols
                  : layouts[j]['totalColumns'] as int;
        }
      }
      layouts[i]['totalColumns'] = maxCols;
    }

    return layouts;
  }

  /// Checks if two events overlap in time.
  static bool _eventsOverlap(CalendarEvent event1, CalendarEvent event2) {
    return event1.startDateTime.isBefore(event2.endDateTime) &&
        event1.endDateTime.isAfter(event2.startDateTime);
  }

  /// Generates hour labels for timeline views (0-23).
  static List<String> generateHourLabels() {
    final labels = <String>[];
    for (var hour = 0; hour < 24; hour++) {
      labels.add('${hour.toString().padLeft(2, '0')}:00');
    }
    return labels;
  }

  /// Gets the week number of a date in the year.
  static int getWeekNumber(DateTime date) {
    final firstDayOfYear = DateTime(date.year, 1, 1);
    final daysSinceFirstDay = date.difference(firstDayOfYear).inDays;
    return (daysSinceFirstDay / 7).floor() + 1;
  }
}
