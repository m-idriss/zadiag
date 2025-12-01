import 'package:flutter_test/flutter_test.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/models/conversion_result.dart';

void main() {
  group('ConversionResult', () {
    test('success factory creates successful result', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event 1',
          startDateTime: DateTime(2024, 1, 15, 10, 0),
          endDateTime: DateTime(2024, 1, 15, 11, 0),
        ),
      ];

      final result = ConversionResult.success(events, processingTimeMs: 500);

      expect(result.success, true);
      expect(result.events, hasLength(1));
      expect(result.errorMessage, isNull);
      expect(result.processingTimeMs, 500);
    });

    test('error factory creates failed result', () {
      final result = ConversionResult.error('Network error');

      expect(result.success, false);
      expect(result.events, isEmpty);
      expect(result.errorMessage, 'Network error');
    });

    test('fromJson creates result correctly from events array', () {
      final json = {
        'success': true,
        'events': [
          {
            'id': '1',
            'title': 'Test Event',
            'startDateTime': '2024-01-15T10:00:00.000Z',
            'endDateTime': '2024-01-15T11:00:00.000Z',
          },
          {
            'id': '2',
            'title': 'Another Event',
            'startDateTime': '2024-01-16T14:00:00.000Z',
            'endDateTime': '2024-01-16T15:00:00.000Z',
          },
        ],
        'processingTimeMs': 1200,
      };

      final result = ConversionResult.fromJson(json);

      expect(result.success, true);
      expect(result.events, hasLength(2));
      expect(result.events[0].title, 'Test Event');
      expect(result.events[1].title, 'Another Event');
      expect(result.processingTimeMs, 1200);
    });

    test('fromJson parses icsContent string and extracts events', () {
      final json = {
        'success': true,
        'icsContent': '''BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//YourApp//YourAppCalendar//EN
BEGIN:VEVENT
UID:20251012T122200-cap3000@example.com
DTSTAMP:20251201T222452Z
DTSTART;TZID=CET:20251012T122200
DTEND;TZID=CET:20251012T155500
SUMMARY:Apple Store iPhone 17
DESCRIPTION:Apple Store iPhone 17
LOCATION:cap3000
END:VEVENT
END:VCALENDAR''',
        'processingTimeMs': 3465,
      };

      final result = ConversionResult.fromJson(json);

      expect(result.success, true);
      expect(result.events, hasLength(1));
      expect(result.events[0].title, 'Apple Store iPhone 17');
      expect(result.events[0].location, 'cap3000');
      expect(result.icsContent, isNotNull);
      expect(result.processingTimeMs, 3465);
    });

    test('fromJson parses icsContent with multiple events', () {
      final json = {
        'success': true,
        'icsContent': '''BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event1@example.com
DTSTART:20251201T090000
DTEND:20251201T100000
SUMMARY:SC. ECONO.& SOCIALES
DESCRIPTION:MAMMADHUSEYN K.
LOCATION:B116
END:VEVENT
BEGIN:VEVENT
UID:event2@example.com
DTSTART:20251201T100000
DTEND:20251201T110000
SUMMARY:FRANCAIS
DESCRIPTION:DAL MOLIN C.
LOCATION:B128
END:VEVENT
END:VCALENDAR''',
      };

      final result = ConversionResult.fromJson(json);

      expect(result.success, true);
      expect(result.events, hasLength(2));
      expect(result.events[0].title, 'SC. ECONO.& SOCIALES');
      expect(result.events[1].title, 'FRANCAIS');
    });

    test('fromJson handles error response', () {
      final json = {
        'success': false,
        'events': <Map<String, dynamic>>[],
        'error': 'Image processing failed',
      };

      final result = ConversionResult.fromJson(json);

      expect(result.success, false);
      expect(result.events, isEmpty);
      expect(result.errorMessage, 'Image processing failed');
    });

    test('eventCount returns correct count', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event 1',
          startDateTime: DateTime(2024, 1, 15, 10, 0),
          endDateTime: DateTime(2024, 1, 15, 11, 0),
        ),
        CalendarEvent(
          id: '2',
          title: 'Event 2',
          startDateTime: DateTime(2024, 1, 16, 10, 0),
          endDateTime: DateTime(2024, 1, 16, 11, 0),
        ),
      ];

      final result = ConversionResult.success(events);

      expect(result.eventCount, 2);
    });

    test('hasEvents returns true when events exist', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event',
          startDateTime: DateTime(2024, 1, 15, 10, 0),
          endDateTime: DateTime(2024, 1, 15, 11, 0),
        ),
      ];

      final result = ConversionResult.success(events);
      expect(result.hasEvents, true);
    });

    test('hasEvents returns false when no events', () {
      final result = ConversionResult.error('No events found');
      expect(result.hasEvents, false);
    });

    test('toJson serializes correctly', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Test',
          startDateTime: DateTime.utc(2024, 1, 15, 10, 0),
          endDateTime: DateTime.utc(2024, 1, 15, 11, 0),
        ),
      ];

      final result = ConversionResult(
        success: true,
        events: events,
        processingTimeMs: 1000,
      );

      final json = result.toJson();

      expect(json['success'], true);
      expect(json['events'], hasLength(1));
      expect(json['processingTimeMs'], 1000);
    });

    test('toJson includes icsContent when provided', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Test',
          startDateTime: DateTime.utc(2024, 1, 15, 10, 0),
          endDateTime: DateTime.utc(2024, 1, 15, 11, 0),
        ),
      ];

      final result = ConversionResult(
        success: true,
        events: events,
        icsContent: 'BEGIN:VCALENDAR...',
        processingTimeMs: 1000,
      );

      final json = result.toJson();

      expect(json['icsContent'], 'BEGIN:VCALENDAR...');
    });
  });
}
