import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/services/event_storage_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('EventStorageService', () {
    late EventStorageService service;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      service = EventStorageService(prefs: prefs);
    });

    test('saveEvents stores events correctly', () async {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Test Event',
          startDateTime: DateTime(2024, 1, 15, 10, 0),
          endDateTime: DateTime(2024, 1, 15, 11, 0),
        ),
      ];

      final result = await service.saveEvents(events);

      expect(result, true);
    });

    test('loadEvents retrieves saved events', () async {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Test Event',
          description: 'Test Description',
          startDateTime: DateTime(2024, 1, 15, 10, 0),
          endDateTime: DateTime(2024, 1, 15, 11, 0),
          location: 'Test Location',
        ),
        CalendarEvent(
          id: '2',
          title: 'Second Event',
          startDateTime: DateTime(2024, 1, 16, 14, 0),
          endDateTime: DateTime(2024, 1, 16, 15, 0),
        ),
      ];

      await service.saveEvents(events);
      final loadedEvents = await service.loadEvents();

      expect(loadedEvents.length, 2);
      expect(loadedEvents[0].id, '1');
      expect(loadedEvents[0].title, 'Test Event');
      expect(loadedEvents[0].description, 'Test Description');
      expect(loadedEvents[0].location, 'Test Location');
      expect(loadedEvents[1].id, '2');
      expect(loadedEvents[1].title, 'Second Event');
    });

    test('loadEvents returns empty list when no events saved', () async {
      final events = await service.loadEvents();

      expect(events, isEmpty);
    });

    test('saveEvents with icsContent saves ICS', () async {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event',
          startDateTime: DateTime(2024, 1, 15, 10, 0),
          endDateTime: DateTime(2024, 1, 15, 11, 0),
        ),
      ];
      const icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';

      await service.saveEvents(events, icsContent: icsContent);
      final loadedIcs = await service.loadIcsContent();

      expect(loadedIcs, icsContent);
    });

    test('loadIcsContent returns null when no ICS saved', () async {
      final ics = await service.loadIcsContent();

      expect(ics, isNull);
    });

    test('clearEvents removes all saved data', () async {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event',
          startDateTime: DateTime(2024, 1, 15, 10, 0),
          endDateTime: DateTime(2024, 1, 15, 11, 0),
        ),
      ];
      await service.saveEvents(events, icsContent: 'test');

      final result = await service.clearEvents();

      expect(result, true);
      expect(await service.loadEvents(), isEmpty);
      expect(await service.loadIcsContent(), isNull);
    });

    test('hasEvents returns true when events exist', () async {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event',
          startDateTime: DateTime(2024, 1, 15, 10, 0),
          endDateTime: DateTime(2024, 1, 15, 11, 0),
        ),
      ];
      await service.saveEvents(events);

      final hasEvents = await service.hasEvents();

      expect(hasEvents, true);
    });

    test('hasEvents returns false when no events', () async {
      final hasEvents = await service.hasEvents();

      expect(hasEvents, false);
    });

    test('saving new events replaces old events', () async {
      final oldEvents = [
        CalendarEvent(
          id: '1',
          title: 'Old Event',
          startDateTime: DateTime(2024, 1, 15, 10, 0),
          endDateTime: DateTime(2024, 1, 15, 11, 0),
        ),
      ];
      await service.saveEvents(oldEvents);

      final newEvents = [
        CalendarEvent(
          id: '2',
          title: 'New Event',
          startDateTime: DateTime(2024, 1, 20, 10, 0),
          endDateTime: DateTime(2024, 1, 20, 11, 0),
        ),
      ];
      await service.saveEvents(newEvents);

      final loadedEvents = await service.loadEvents();

      expect(loadedEvents.length, 1);
      expect(loadedEvents[0].id, '2');
      expect(loadedEvents[0].title, 'New Event');
    });

    test('saving events without icsContent clears old ICS', () async {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event',
          startDateTime: DateTime(2024, 1, 15, 10, 0),
          endDateTime: DateTime(2024, 1, 15, 11, 0),
        ),
      ];
      await service.saveEvents(events, icsContent: 'old ics');
      await service.saveEvents(events); // No icsContent this time

      final ics = await service.loadIcsContent();

      expect(ics, isNull);
    });

    test('loadEvents handles malformed JSON gracefully', () async {
      SharedPreferences.setMockInitialValues({
        'converter_saved_events': 'not a valid json',
      });
      final prefs = await SharedPreferences.getInstance();
      final malformedService = EventStorageService(prefs: prefs);

      final events = await malformedService.loadEvents();

      expect(events, isEmpty);
    });

    test('loadEvents handles non-list JSON gracefully', () async {
      SharedPreferences.setMockInitialValues({
        'converter_saved_events': '{"key": "value"}',
      });
      final prefs = await SharedPreferences.getInstance();
      final malformedService = EventStorageService(prefs: prefs);

      final events = await malformedService.loadEvents();

      expect(events, isEmpty);
    });
  });
}
