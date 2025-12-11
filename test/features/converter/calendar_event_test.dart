import 'package:flutter_test/flutter_test.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';

void main() {
  group('CalendarEvent', () {
    test('creates event with required fields', () {
      final event = CalendarEvent(
        id: '1',
        title: 'Test Event',
        start: DateTime(2024, 1, 15, 10, 0),
        end: DateTime(2024, 1, 15, 11, 0),
      );

      expect(event.id, '1');
      expect(event.title, 'Test Event');
      expect(event.startDateTime, DateTime(2024, 1, 15, 10, 0));
      expect(event.endDateTime, DateTime(2024, 1, 15, 11, 0));
      expect(event.description, isNull);
      expect(event.location, isNull);
      expect(event.isAllDay, false);
      expect(event.reminders, isEmpty);
    });

    test('creates event with optional fields', () {
      final event = CalendarEvent(
        id: '2',
        title: 'Meeting',
        description: 'Weekly sync',
        start: DateTime(2024, 1, 15, 14, 0),
        end: DateTime(2024, 1, 15, 15, 0),
        location: 'Conference Room A',
        isAllDay: false,
        reminders: [15, 30],
      );

      expect(event.description, 'Weekly sync');
      expect(event.location, 'Conference Room A');
      expect(event.reminders, [15, 30]);
    });

    test('fromJson creates event correctly', () {
      final json = {
        'id': '3',
        'title': 'Doctor Appointment',
        'description': 'Annual checkup',
        'startDateTime': '2024-01-20T09:00:00.000Z',
        'endDateTime': '2024-01-20T10:00:00.000Z',
        'location': 'Medical Center',
        'isAllDay': false,
        'reminders': [30, 60],
      };

      final event = CalendarEvent.fromJson(json);

      expect(event.id, '3');
      expect(event.title, 'Doctor Appointment');
      expect(event.description, 'Annual checkup');
      expect(event.location, 'Medical Center');
      expect(event.reminders, [30, 60]);
    });

    test('fromJson handles alternative field names', () {
      final json = {
        'summary': 'Team Standup',
        'start': '2024-01-21T10:00:00.000Z',
        'end': '2024-01-21T10:15:00.000Z',
        'allDay': true,
      };

      final event = CalendarEvent.fromJson(json);

      expect(event.title, 'Team Standup');
      expect(event.isAllDay, true);
    });

    test('toJson serializes correctly', () {
      final event = CalendarEvent(
        id: '4',
        title: 'Test',
        description: 'Description',
        start: DateTime.utc(2024, 1, 15, 10, 0),
        end: DateTime.utc(2024, 1, 15, 11, 0),
        location: 'Location',
        reminders: [15],
      );

      final json = event.toJson();

      expect(json['id'], '4');
      expect(json['title'], 'Test');
      expect(json['description'], 'Description');
      expect(json['location'], 'Location');
      expect(json['reminders'], [15]);
    });

    test('copyWith creates modified copy', () {
      final original = CalendarEvent(
        id: '5',
        title: 'Original',
        start: DateTime(2024, 1, 15, 10, 0),
        end: DateTime(2024, 1, 15, 11, 0),
      );

      final modified = original.copyWith(
        title: 'Modified',
        location: 'New Location',
      );

      expect(modified.id, '5'); // Unchanged
      expect(modified.title, 'Modified');
      expect(modified.location, 'New Location');
      expect(original.title, 'Original'); // Original unchanged
    });

    test('duration calculates correctly', () {
      final now = DateTime(2024, 1, 15, 9, 0);
      final event = CalendarEvent(
        id: '6',
        title: 'Long Meeting',
        start: now,
        end: now.add(const Duration(hours: 3)),
      );

      expect(event.duration, const Duration(hours: 3));
    });

    test('equality based on id', () {
      final event1 = CalendarEvent(
        id: '7',
        title: 'Event 1',
        start: DateTime(2024, 1, 15, 10, 0),
        end: DateTime(2024, 1, 15, 11, 0),
      );

      final event2 = CalendarEvent(
        id: '7',
        title: 'Event 2', // Different title
        start: DateTime(2024, 1, 16, 10, 0), // Different date
        end: DateTime(2024, 1, 16, 11, 0),
      );

      expect(event1, equals(event2)); // Same ID = equal
    });
  });
}
