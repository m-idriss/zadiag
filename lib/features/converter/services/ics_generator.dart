import '../models/calendar_event.dart';

/// Service for generating ICS (iCalendar) files from calendar events.
class IcsGenerator {
  /// Product identifier for the ICS file
  static const String prodId = '-//Zadiag//Image to ICS//EN';

  /// Generates an ICS formatted string from a list of calendar events.
  String generateIcs(List<CalendarEvent> events) {
    final buffer = StringBuffer();

    // Calendar header
    buffer.writeln('BEGIN:VCALENDAR');
    buffer.writeln('VERSION:2.0');
    buffer.writeln('PRODID:$prodId');
    buffer.writeln('CALSCALE:GREGORIAN');
    buffer.writeln('METHOD:REQUEST');
    buffer.writeln('X-WR-CALNAME:Zadiag Calendar Events');
    buffer.writeln('X-WR-TIMEZONE:UTC');

    // Add each event
    for (final event in events) {
      buffer.writeln(_generateVEvent(event));
    }

    // Calendar footer
    buffer.writeln('END:VCALENDAR');

    return buffer.toString();
  }

  /// Generates a single VEVENT block for an event.
  String _generateVEvent(CalendarEvent event) {
    final buffer = StringBuffer();

    buffer.writeln('BEGIN:VEVENT');

    // Unique identifier
    buffer.writeln('UID:${event.id}@zadiag.app');

    // Timestamp for when this ICS was created
    buffer.writeln('DTSTAMP:${_formatDateTime(DateTime.now().toUtc())}');

    // Start and end times
    if (event.isAllDay) {
      buffer.writeln('DTSTART;VALUE=DATE:${_formatDate(event.startDateTime)}');
      buffer.writeln('DTEND;VALUE=DATE:${_formatDate(event.endDateTime)}');
    } else {
      buffer.writeln('DTSTART:${_formatDateTime(event.startDateTime.toUtc())}');
      buffer.writeln('DTEND:${_formatDateTime(event.endDateTime.toUtc())}');
    }

    // Summary/Title
    buffer.writeln('SUMMARY:${_escapeText(event.title)}');

    // Description (optional)
    if (event.description != null && event.description!.isNotEmpty) {
      buffer.writeln('DESCRIPTION:${_escapeText(event.description!)}');
    }

    // Location (optional)
    if (event.location != null && event.location!.isNotEmpty) {
      buffer.writeln('LOCATION:${_escapeText(event.location!)}');
    }

    // Reminders/Alarms
    for (final minutes in event.reminders) {
      buffer.writeln(_generateVAlarm(minutes));
    }

    buffer.write('END:VEVENT');

    return buffer.toString();
  }

  /// Generates a VALARM block for a reminder.
  String _generateVAlarm(int minutesBefore) {
    final buffer = StringBuffer();

    buffer.writeln('BEGIN:VALARM');
    buffer.writeln('TRIGGER:-PT${minutesBefore}M');
    buffer.writeln('ACTION:DISPLAY');
    buffer.writeln('DESCRIPTION:Reminder');
    buffer.write('END:VALARM');

    return buffer.toString();
  }

  /// Formats a DateTime to ICS format (YYYYMMDDTHHMMSSZ).
  String _formatDateTime(DateTime dateTime) {
    return '${dateTime.year.toString().padLeft(4, '0')}'
        '${dateTime.month.toString().padLeft(2, '0')}'
        '${dateTime.day.toString().padLeft(2, '0')}T'
        '${dateTime.hour.toString().padLeft(2, '0')}'
        '${dateTime.minute.toString().padLeft(2, '0')}'
        '${dateTime.second.toString().padLeft(2, '0')}Z';
  }

  /// Formats a DateTime to ICS date-only format (YYYYMMDD).
  String _formatDate(DateTime dateTime) {
    return '${dateTime.year.toString().padLeft(4, '0')}'
        '${dateTime.month.toString().padLeft(2, '0')}'
        '${dateTime.day.toString().padLeft(2, '0')}';
  }

  /// Escapes special characters for ICS text values.
  String _escapeText(String text) {
    return text
        .replaceAll('\\', '\\\\')
        .replaceAll(';', '\\;')
        .replaceAll(',', '\\,')
        .replaceAll('\n', '\\n')
        .replaceAll('\r', '');
  }
}
