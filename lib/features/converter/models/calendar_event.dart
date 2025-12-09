import 'package:isar/isar.dart';

part 'calendar_event.g.dart';

/// Model representing a calendar event extracted from an image.
@embedded
class CalendarEvent {
  /// Unique identifier for the event
  final String id;

  /// Event name/summary
  final String title;

  /// Event details/description
  final String? description;

  /// Start date and time
  DateTime startDateTime = DateTime.now();

  /// End date and time
  DateTime endDateTime = DateTime.now();

  /// Event location (optional)
  final String? location;

  /// Whether this is an all-day event
  final bool isAllDay;

  /// List of reminder times in minutes before the event
  final List<int> reminders;

  CalendarEvent({
    this.id = '',
    this.title = '',
    this.description,
    DateTime? start,
    DateTime? end,
    this.location,
    this.isAllDay = false,
    this.reminders = const [],
  }) {
    if (start != null) startDateTime = start;
    if (end != null) endDateTime = end;
  }

  /// Creates a CalendarEvent from JSON response
  factory CalendarEvent.fromJson(Map<String, dynamic> json) {
    return CalendarEvent(
      id:
          json['id']?.toString() ??
          DateTime.now().millisecondsSinceEpoch.toString(),
      title: json['title'] ?? json['summary'] ?? 'Untitled Event',
      description: json['description'],
      start: _parseDateTime(json['startDateTime'] ?? json['start']),
      end: _parseDateTime(json['endDateTime'] ?? json['end']),
      location: json['location'],
      isAllDay: json['isAllDay'] ?? json['allDay'] ?? false,
      reminders:
          (json['reminders'] as List<dynamic>?)
              ?.map((e) => e as int)
              .toList() ??
          [],
    );
  }

  /// Parses a date time from various formats
  static DateTime _parseDateTime(dynamic value) {
    if (value == null) {
      return DateTime.now();
    }
    if (value is DateTime) {
      return value;
    }
    if (value is String) {
      return DateTime.tryParse(value) ?? DateTime.now();
    }
    return DateTime.now();
  }

  /// Converts the event to JSON format
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'startDateTime': startDateTime.toIso8601String(),
      'endDateTime': endDateTime.toIso8601String(),
      'location': location,
      'isAllDay': isAllDay,
      'reminders': reminders,
    };
  }

  /// Creates a copy of this event with modified fields
  CalendarEvent copyWith({
    String? id,
    String? title,
    String? description,
    DateTime? startDateTime,
    DateTime? endDateTime,
    String? location,
    bool? isAllDay,
    List<int>? reminders,
  }) {
    return CalendarEvent(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      start: startDateTime ?? this.startDateTime,
      end: endDateTime ?? this.endDateTime,
      location: location ?? this.location,
      isAllDay: isAllDay ?? this.isAllDay,
      reminders: reminders ?? this.reminders,
    );
  }

  /// Calculates the duration of the event
  @ignore
  Duration get duration => endDateTime.difference(startDateTime);

  @override
  String toString() {
    return 'CalendarEvent(id: $id, title: $title, start: $startDateTime, end: $endDateTime)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is CalendarEvent && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}
