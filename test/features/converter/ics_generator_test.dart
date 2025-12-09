import 'package:flutter_test/flutter_test.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/services/ics_generator.dart';

void main() {
  late IcsGenerator generator;

  setUp(() {
    generator = IcsGenerator();
  });

  group('IcsGenerator', () {
    test('generates valid ICS header and footer', () {
      final events = <CalendarEvent>[];
      final ics = generator.generateIcs(events);

      expect(ics, contains('BEGIN:VCALENDAR'));
      expect(ics, contains('VERSION:2.0'));
      expect(ics, contains('PRODID:-//Zadiag//Image to ICS//EN'));
      expect(ics, contains('CALSCALE:GREGORIAN'));
      expect(ics, contains('METHOD:PUBLISH'));
      expect(ics, contains('END:VCALENDAR'));
    });

    test('generates single event correctly', () {
      final events = [
        CalendarEvent(
          id: 'test-123',
          title: 'Test Meeting',
          description: 'A test meeting',
          start: DateTime.utc(2024, 1, 15, 10, 0),
          end: DateTime.utc(2024, 1, 15, 11, 0),
          location: 'Room 101',
        ),
      ];

      final ics = generator.generateIcs(events);

      expect(ics, contains('BEGIN:VEVENT'));
      expect(ics, contains('UID:test-123@zadiag.app'));
      expect(ics, contains('DTSTART:20240115T100000Z'));
      expect(ics, contains('DTEND:20240115T110000Z'));
      expect(ics, contains('SUMMARY:Test Meeting'));
      expect(ics, contains('DESCRIPTION:A test meeting'));
      expect(ics, contains('LOCATION:Room 101'));
      expect(ics, contains('END:VEVENT'));
    });

    test('generates multiple events', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event 1',
          start: DateTime.utc(2024, 1, 15, 10, 0),
          end: DateTime.utc(2024, 1, 15, 11, 0),
        ),
        CalendarEvent(
          id: '2',
          title: 'Event 2',
          start: DateTime.utc(2024, 1, 16, 14, 0),
          end: DateTime.utc(2024, 1, 16, 15, 0),
        ),
      ];

      final ics = generator.generateIcs(events);

      // Count VEVENT occurrences
      final veventMatches = RegExp(r'BEGIN:VEVENT').allMatches(ics);
      expect(veventMatches.length, 2);

      expect(ics, contains('UID:1@zadiag.app'));
      expect(ics, contains('UID:2@zadiag.app'));
      expect(ics, contains('SUMMARY:Event 1'));
      expect(ics, contains('SUMMARY:Event 2'));
    });

    test('generates all-day events correctly', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'All Day Event',
          start: DateTime.utc(2024, 1, 15),
          end: DateTime.utc(2024, 1, 16),
          isAllDay: true,
        ),
      ];

      final ics = generator.generateIcs(events);

      expect(ics, contains('DTSTART;VALUE=DATE:20240115'));
      expect(ics, contains('DTEND;VALUE=DATE:20240116'));
    });

    test('includes reminders as VALARM', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event with Reminder',
          start: DateTime.utc(2024, 1, 15, 10, 0),
          end: DateTime.utc(2024, 1, 15, 11, 0),
          reminders: [15, 30],
        ),
      ];

      final ics = generator.generateIcs(events);

      expect(ics, contains('BEGIN:VALARM'));
      expect(ics, contains('TRIGGER:-PT15M'));
      expect(ics, contains('TRIGGER:-PT30M'));
      expect(ics, contains('ACTION:DISPLAY'));
      expect(ics, contains('END:VALARM'));

      // Count VALARM occurrences
      final valarmMatches = RegExp(r'BEGIN:VALARM').allMatches(ics);
      expect(valarmMatches.length, 2);
    });

    test('escapes special characters in text', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Meeting, Important; Review',
          description: 'Line 1\nLine 2',
          start: DateTime.utc(2024, 1, 15, 10, 0),
          end: DateTime.utc(2024, 1, 15, 11, 0),
        ),
      ];

      final ics = generator.generateIcs(events);

      expect(ics, contains('SUMMARY:Meeting\\, Important\\; Review'));
      expect(ics, contains('DESCRIPTION:Line 1\\nLine 2'));
    });

    test('omits optional fields when not provided', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Simple Event',
          start: DateTime.utc(2024, 1, 15, 10, 0),
          end: DateTime.utc(2024, 1, 15, 11, 0),
        ),
      ];

      final ics = generator.generateIcs(events);

      expect(ics, isNot(contains('DESCRIPTION:')));
      expect(ics, isNot(contains('LOCATION:')));
    });

    test('includes DTSTAMP for each event', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Test Event',
          start: DateTime.utc(2024, 1, 15, 10, 0),
          end: DateTime.utc(2024, 1, 15, 11, 0),
        ),
      ];

      final ics = generator.generateIcs(events);

      expect(ics, contains('DTSTAMP:'));
    });
  });
}
