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

    test('fromJson creates result correctly', () {
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
  });
}
