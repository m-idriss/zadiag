import '../models/calendar_event.dart';

/// Service for parsing ICS (iCalendar) content into CalendarEvent objects.
class IcsParser {
  /// Parses ICS content string and returns a list of CalendarEvent objects.
  static List<CalendarEvent> parse(String icsContent) {
    final events = <CalendarEvent>[];

    // Split by VEVENT blocks
    final eventBlocks = _extractVEventBlocks(icsContent);

    for (int i = 0; i < eventBlocks.length; i++) {
      final event = _parseVEvent(eventBlocks[i], i);
      if (event != null) {
        events.add(event);
      }
    }

    return events;
  }

  /// Extracts all VEVENT blocks from the ICS content.
  static List<String> _extractVEventBlocks(String icsContent) {
    final blocks = <String>[];
    final regex = RegExp(r'BEGIN:VEVENT(.*?)END:VEVENT', dotAll: true);
    final matches = regex.allMatches(icsContent);

    for (final match in matches) {
      blocks.add(match.group(0) ?? '');
    }

    return blocks;
  }

  /// Parses a single VEVENT block into a CalendarEvent.
  static CalendarEvent? _parseVEvent(String veventBlock, int index) {
    try {
      final properties = _parseProperties(veventBlock);

      final uid =
          properties['UID'] ??
          '${DateTime.now().millisecondsSinceEpoch}-$index';
      final summary = properties['SUMMARY'] ?? 'Untitled Event';
      final description = properties['DESCRIPTION'];
      final location = properties['LOCATION'];

      // Parse start and end times - look for both plain and TZID versions
      final dtStart = _parseDateTimeProperty(properties, 'DTSTART');
      final dtEnd = _parseDateTimeProperty(properties, 'DTEND');

      // Check for all-day event (VALUE=DATE parameter)
      final isAllDay = _hasDateOnlyParameter(properties, 'DTSTART');

      return CalendarEvent(
        id: uid,
        title: _unescapeIcsText(summary),
        description: description != null ? _unescapeIcsText(description) : null,
        start: dtStart,
        end: dtEnd,
        location:
            location != null && location.isNotEmpty
                ? _unescapeIcsText(location)
                : null,
        isAllDay: isAllDay,
        reminders: [], // ICS alarms would need separate parsing
      );
    } catch (e) {
      // Return null if parsing fails for this event
      return null;
    }
  }

  /// Parses a datetime property, handling various formats including TZID parameters.
  static DateTime _parseDateTimeProperty(
    Map<String, String> properties,
    String baseName,
  ) {
    // Try different property key formats:
    // 1. DTSTART (plain)
    // 2. DTSTART;VALUE=DATE (date only)
    // 3. DTSTART;TZID=XXX (with timezone - value is the datetime, not timezone)

    String? value;

    // First, look for properties with TZID parameter (e.g., DTSTART;TZID=CET:20251012T122200)
    for (final key in properties.keys) {
      if (key.startsWith('$baseName;TZID=')) {
        value = properties[key];
        break;
      }
    }

    // If not found, look for VALUE=DATE parameter (date only)
    if (value == null) {
      for (final key in properties.keys) {
        if (key.startsWith('$baseName;VALUE=DATE')) {
          value = properties[key];
          break;
        }
      }
    }

    // If still not found, use the plain property
    value ??= properties[baseName];

    if (value == null || value.isEmpty) {
      return DateTime.now();
    }

    return _parseIcsDateTimeValue(value);
  }

  /// Checks if a property has VALUE=DATE parameter (indicates all-day event).
  static bool _hasDateOnlyParameter(
    Map<String, String> properties,
    String baseName,
  ) {
    for (final key in properties.keys) {
      if (key.startsWith('$baseName;VALUE=DATE')) {
        return true;
      }
    }
    return false;
  }

  /// Parses ICS properties from a VEVENT block.
  static Map<String, String> _parseProperties(String veventBlock) {
    final properties = <String, String>{};

    // Handle line folding (lines starting with space/tab are continuations)
    final unfoldedContent = veventBlock.replaceAll(RegExp(r'\r?\n[ \t]'), '');

    final lines = unfoldedContent.split(RegExp(r'\r?\n'));

    for (final line in lines) {
      if (line.isEmpty || line == 'BEGIN:VEVENT' || line == 'END:VEVENT') {
        continue;
      }

      // Find the first colon that separates property name from value
      final colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        final propertyName = line.substring(0, colonIndex).trim();
        final propertyValue = line.substring(colonIndex + 1).trim();

        // Store the full property name (including parameters)
        properties[propertyName] = propertyValue;

        // Also store under base property name if it has parameters
        if (propertyName.contains(';')) {
          final baseName = propertyName.split(';').first;
          if (!properties.containsKey(baseName)) {
            properties[baseName] = propertyValue;
          }
        }
      }
    }

    return properties;
  }

  /// Parses ICS datetime value string into DateTime object.
  static DateTime _parseIcsDateTimeValue(String value) {
    // Remove any timezone suffix (Z for UTC)
    value = value.replaceAll('Z', '');

    // Parse formats:
    // - YYYYMMDD (date only)
    // - YYYYMMDDTHHmmss (local time)
    // - YYYYMMDDTHHmmssZ (UTC)

    try {
      if (value.length == 8 && !value.contains('T')) {
        // Date only: YYYYMMDD
        final year = int.parse(value.substring(0, 4));
        final month = int.parse(value.substring(4, 6));
        final day = int.parse(value.substring(6, 8));
        return DateTime(year, month, day);
      } else if (value.contains('T')) {
        // DateTime: YYYYMMDDTHHmmss
        final datePart = value.split('T')[0];
        final timePart = value.split('T')[1];

        final year = int.parse(datePart.substring(0, 4));
        final month = int.parse(datePart.substring(4, 6));
        final day = int.parse(datePart.substring(6, 8));

        final hour = int.parse(timePart.substring(0, 2));
        final minute = int.parse(timePart.substring(2, 4));
        final second =
            timePart.length >= 6 ? int.parse(timePart.substring(4, 6)) : 0;

        return DateTime(year, month, day, hour, minute, second);
      } else {
        // Try ISO 8601 parsing as fallback
        return DateTime.tryParse(value) ?? DateTime.now();
      }
    } catch (e) {
      return DateTime.now();
    }
  }

  /// Unescapes ICS text by replacing escaped characters.
  static String _unescapeIcsText(String text) {
    return text
        .replaceAll('\\n', '\n')
        .replaceAll('\\,', ',')
        .replaceAll('\\;', ';')
        .replaceAll('\\\\', '\\');
  }
}
