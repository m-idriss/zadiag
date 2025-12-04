import 'package:flutter_test/flutter_test.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/widgets/calendar_preview_dialog.dart';

void main() {
  group('CalendarViewType', () {
    test('enum has all expected values', () {
      expect(CalendarViewType.values.length, 3);
      expect(CalendarViewType.values, contains(CalendarViewType.daily));
      expect(CalendarViewType.values, contains(CalendarViewType.weekly));
      expect(CalendarViewType.values, contains(CalendarViewType.monthly));
    });
  });

  group('CalendarPreviewDialog with events', () {
    final testEvents = [
      CalendarEvent(
        id: '1',
        title: 'Morning Meeting',
        startDateTime: DateTime(2024, 1, 15, 9, 0),
        endDateTime: DateTime(2024, 1, 15, 10, 0),
        location: 'Conference Room A',
      ),
      CalendarEvent(
        id: '2',
        title: 'Lunch Break',
        startDateTime: DateTime(2024, 1, 15, 12, 0),
        endDateTime: DateTime(2024, 1, 15, 13, 0),
        isAllDay: false,
      ),
      CalendarEvent(
        id: '3',
        title: 'All Day Event',
        startDateTime: DateTime(2024, 1, 16, 0, 0),
        endDateTime: DateTime(2024, 1, 16, 23, 59),
        isAllDay: true,
      ),
    ];

    test('CalendarPreviewDialog can be instantiated with events', () {
      final dialog = CalendarPreviewDialog(events: testEvents);
      expect(dialog.events, testEvents);
      expect(dialog.events.length, 3);
    });

    test('CalendarPreviewDialog handles empty events list', () {
      final dialog = CalendarPreviewDialog(events: const []);
      expect(dialog.events, isEmpty);
    });

    test('Events are correctly structured for calendar display', () {
      final event = testEvents.first;
      expect(event.title, 'Morning Meeting');
      expect(event.startDateTime.hour, 9);
      expect(event.endDateTime.hour, 10);
      expect(event.location, 'Conference Room A');
    });

    test('All day events are correctly identified', () {
      final allDayEvent = testEvents.firstWhere((e) => e.isAllDay);
      expect(allDayEvent.title, 'All Day Event');
      expect(allDayEvent.isAllDay, true);
    });

    test('Events span multiple days correctly', () {
      final day1Events = testEvents.where((e) =>
        e.startDateTime.day == 15 && e.startDateTime.month == 1
      ).toList();
      final day2Events = testEvents.where((e) =>
        e.startDateTime.day == 16 && e.startDateTime.month == 1
      ).toList();

      expect(day1Events.length, 2);
      expect(day2Events.length, 1);
    });
  });

  group('Week calculation', () {
    test('Week start is Monday for various dates', () {
      // Test helper function to get week start
      DateTime getWeekStart(DateTime date) {
        final daysFromMonday = date.weekday - 1;
        return DateTime(date.year, date.month, date.day - daysFromMonday);
      }

      // Wednesday Jan 17, 2024 - week starts Jan 15 (Monday)
      final wednesday = DateTime(2024, 1, 17);
      final weekStart = getWeekStart(wednesday);
      expect(weekStart.weekday, DateTime.monday);
      expect(weekStart.day, 15);

      // Sunday Jan 21, 2024 - week starts Jan 15 (Monday)
      final sunday = DateTime(2024, 1, 21);
      final sundayWeekStart = getWeekStart(sunday);
      expect(sundayWeekStart.weekday, DateTime.monday);
      expect(sundayWeekStart.day, 15);

      // Monday Jan 15, 2024 - week starts same day
      final monday = DateTime(2024, 1, 15);
      final mondayWeekStart = getWeekStart(monday);
      expect(mondayWeekStart.weekday, DateTime.monday);
      expect(mondayWeekStart.day, 15);
    });
  });

  group('Date comparison', () {
    test('isToday helper correctly identifies today', () {
      bool isToday(DateTime date) {
        final now = DateTime.now();
        return date.year == now.year &&
            date.month == now.month &&
            date.day == now.day;
      }

      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final yesterday = today.subtract(const Duration(days: 1));
      final tomorrow = today.add(const Duration(days: 1));

      expect(isToday(today), true);
      expect(isToday(yesterday), false);
      expect(isToday(tomorrow), false);
    });
  });
}
