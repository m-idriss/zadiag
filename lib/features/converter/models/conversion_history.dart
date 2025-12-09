import 'package:isar/isar.dart';
import 'calendar_event.dart';

part 'conversion_history.g.dart';

/// Model representing a conversion history entry.
///
/// Each entry tracks when a user converted events to ICS format,
/// including the events themselves and the generated ICS content.
@collection
class ConversionHistory {
  /// Unique identifier for the conversion.
  Id id = Isar.autoIncrement;

  /// When the conversion was created
  final DateTime timestamp;

  /// List of calendar events that were converted
  final List<CalendarEvent> events;

  /// Number of events converted
  final int eventCount;

  /// Generated ICS content (for archiving and re-download)
  final String icsContent;

  /// User ID who performed the conversion
  @Index(type: IndexType.value)
  final String userId;

  ConversionHistory({
    this.id = Isar.autoIncrement,
    required this.timestamp,
    required this.events,
    required this.eventCount,
    required this.icsContent,
    required this.userId,
  });

  /// Creates a copy with modified fields
  ConversionHistory copyWith({
    Id? id,
    DateTime? timestamp,
    List<CalendarEvent>? events,
    int? eventCount,
    String? icsContent,
    String? userId,
  }) {
    return ConversionHistory(
      id: id ?? this.id,
      timestamp: timestamp ?? this.timestamp,
      events: events != null ? List<CalendarEvent>.from(events) : this.events,
      eventCount: eventCount ?? this.eventCount,
      icsContent: icsContent ?? this.icsContent,
      userId: userId ?? this.userId,
    );
  }

  @override
  String toString() {
    return 'ConversionHistory(id: $id, timestamp: $timestamp, eventCount: $eventCount)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ConversionHistory && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}
