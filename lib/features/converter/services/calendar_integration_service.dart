import 'package:add_2_calendar/add_2_calendar.dart';
import 'package:zadiag/core/services/log_service.dart';
import '../models/calendar_event.dart';

/// Service for adding events directly to the native calendar.
class CalendarIntegrationService {
  /// Adds all events directly to the device's native calendar.
  ///
  /// This bypasses file sharing and adds events one by one to the calendar.
  /// Returns true if at least one event was successfully added.
  Future<bool> addEventsToCalendar(List<CalendarEvent> events) async {
    if (events.isEmpty) return false;

    int successCount = 0;

    for (final event in events) {
      try {
        final calendarEvent = Event(
          title: event.title,
          description: event.description ?? '',
          location: event.location ?? '',
          startDate: event.startDateTime,
          endDate: event.endDateTime,
          allDay: event.isAllDay,
        );

        final result = await Add2Calendar.addEvent2Cal(calendarEvent);
        if (result) {
          successCount++;
        }

        Log.d(
          'CalendarIntegrationService: Added event to calendar: ${event.title}',
        );
      } catch (e, stack) {
        Log.e(
          'CalendarIntegrationService: Error adding event "${event.title}" to calendar',
          e,
          stack,
        );
        // Continue with other events even if one fails
      }
    }

    return successCount > 0;
  }

  /// Adds a single event to the native calendar.
  Future<bool> addEventToCalendar(CalendarEvent event) async {
    try {
      final calendarEvent = Event(
        title: event.title,
        description: event.description ?? '',
        location: event.location ?? '',
        startDate: event.startDateTime,
        endDate: event.endDateTime,
        allDay: event.isAllDay,
      );

      return await Add2Calendar.addEvent2Cal(calendarEvent);
    } catch (e, stack) {
      Log.e(
        'CalendarIntegrationService: Error adding event to calendar',
        e,
        stack,
      );
      return false;
    }
  }
}
