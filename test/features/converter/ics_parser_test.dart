import 'package:flutter_test/flutter_test.dart';
import 'package:zadiag/features/converter/services/ics_parser.dart';

void main() {
  group('IcsParser', () {
    test('parses simple ICS content with one event', () {
      const icsContent = '''BEGIN:VCALENDAR
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
END:VCALENDAR''';

      final events = IcsParser.parse(icsContent);

      expect(events.length, 1);
      expect(events[0].title, 'Apple Store iPhone 17');
      expect(events[0].description, 'Apple Store iPhone 17');
      expect(events[0].location, 'cap3000');
      expect(events[0].startDateTime.year, 2025);
      expect(events[0].startDateTime.month, 10);
      expect(events[0].startDateTime.day, 12);
      expect(events[0].startDateTime.hour, 12);
      expect(events[0].startDateTime.minute, 22);
    });

    test('parses ICS content with multiple events', () {
      const icsContent = '''BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//YourCalendar//NONSGML v1.0//EN
BEGIN:VEVENT
UID:20251201T090000Z-SC.ECONO.&SOCIALES
DTSTAMP:20251201T222608Z
DTSTART:20251201T090000
DTEND:20251201T100000
SUMMARY:SC. ECONO.& SOCIALES
DESCRIPTION:MAMMADHUSEYN K.
LOCATION:B116
TZID:CET
END:VEVENT
BEGIN:VEVENT
UID:20251201T100000Z-FRANCAIS
DTSTAMP:20251201T222608Z
DTSTART:20251201T100000
DTEND:20251201T110000
SUMMARY:FRANCAIS
DESCRIPTION:DAL MOLIN C.
LOCATION:B128
TZID:CET
END:VEVENT
BEGIN:VEVENT
UID:20251202T080000Z-PHYSIQUE-CHIMIE
DTSTAMP:20251201T222608Z
DTSTART:20251202T080000
DTEND:20251202T090000
SUMMARY:PHYSIQUE-CHIMIE
DESCRIPTION:BASSE M.
LOCATION:
TZID:CET
END:VEVENT
END:VCALENDAR''';

      final events = IcsParser.parse(icsContent);

      expect(events.length, 3);
      
      expect(events[0].title, 'SC. ECONO.& SOCIALES');
      expect(events[0].description, 'MAMMADHUSEYN K.');
      expect(events[0].location, 'B116');
      
      expect(events[1].title, 'FRANCAIS');
      expect(events[1].description, 'DAL MOLIN C.');
      expect(events[1].location, 'B128');
      
      expect(events[2].title, 'PHYSIQUE-CHIMIE');
      expect(events[2].description, 'BASSE M.');
      expect(events[2].location, isNull); // Empty location
    });

    test('parses ICS with escaped characters', () {
      const icsContent = '''BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-escaped@example.com
DTSTART:20251201T090000
DTEND:20251201T100000
SUMMARY:Meeting\\, Important\\; Review
DESCRIPTION:Line 1\\nLine 2
END:VEVENT
END:VCALENDAR''';

      final events = IcsParser.parse(icsContent);

      expect(events.length, 1);
      expect(events[0].title, 'Meeting, Important; Review');
      expect(events[0].description, 'Line 1\nLine 2');
    });

    test('handles date-only format for all-day events', () {
      const icsContent = '''BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:allday@example.com
DTSTART;VALUE=DATE:20251225
DTEND;VALUE=DATE:20251226
SUMMARY:Christmas Day
END:VEVENT
END:VCALENDAR''';

      final events = IcsParser.parse(icsContent);

      expect(events.length, 1);
      expect(events[0].title, 'Christmas Day');
      expect(events[0].isAllDay, true);
      expect(events[0].startDateTime.year, 2025);
      expect(events[0].startDateTime.month, 12);
      expect(events[0].startDateTime.day, 25);
    });

    test('parses real API response format', () {
      // This is an actual response from the API
      const icsContent = '''BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//YourApp//YourAppCalendar//EN
BEGIN:VEVENT
UID:20250911T091500Z-passeport@example.com
DTSTAMP:20251201T222425Z
DTSTART:20250911T091500
DTEND:20250911T101500
SUMMARY:Blocage Planning (passeport)
DESCRIPTION:Blocage Planning
LOCATION:
TZID:CET
END:VEVENT
BEGIN:VEVENT
UID:20250916T104500Z-gyneco@example.com
DTSTAMP:20251201T222425Z
DTSTART:20250916T104500
DTEND:20250916T130000
SUMMARY:Blocage Planning (Gynéco)
DESCRIPTION:Blocage Planning
LOCATION:
TZID:CET
END:VEVENT
END:VCALENDAR''';

      final events = IcsParser.parse(icsContent);

      expect(events.length, 2);
      
      expect(events[0].title, 'Blocage Planning (passeport)');
      expect(events[0].startDateTime.year, 2025);
      expect(events[0].startDateTime.month, 9);
      expect(events[0].startDateTime.day, 11);
      expect(events[0].startDateTime.hour, 9);
      expect(events[0].startDateTime.minute, 15);
      
      expect(events[1].title, 'Blocage Planning (Gynéco)');
      expect(events[1].startDateTime.year, 2025);
      expect(events[1].startDateTime.month, 9);
      expect(events[1].startDateTime.day, 16);
    });

    test('handles empty ICS content', () {
      const icsContent = '''BEGIN:VCALENDAR
VERSION:2.0
END:VCALENDAR''';

      final events = IcsParser.parse(icsContent);

      expect(events.length, 0);
    });

    test('handles malformed ICS content gracefully', () {
      const icsContent = '''This is not valid ICS content''';

      final events = IcsParser.parse(icsContent);

      expect(events.length, 0);
    });
  });
}
