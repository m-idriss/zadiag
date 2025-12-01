import 'calendar_event.dart';
import '../services/ics_parser.dart';

/// Model representing the result of image to calendar conversion.
class ConversionResult {
  /// Whether the conversion was successful
  final bool success;

  /// List of extracted calendar events
  final List<CalendarEvent> events;

  /// Raw ICS content from API (if provided)
  final String? icsContent;

  /// Error message if conversion failed
  final String? errorMessage;

  /// Processing time in milliseconds
  final int? processingTimeMs;

  ConversionResult({
    required this.success,
    required this.events,
    this.icsContent,
    this.errorMessage,
    this.processingTimeMs,
  });

  /// Creates a successful result with events
  factory ConversionResult.success(List<CalendarEvent> events,
      {int? processingTimeMs, String? icsContent}) {
    return ConversionResult(
      success: true,
      events: events,
      icsContent: icsContent,
      processingTimeMs: processingTimeMs,
    );
  }

  /// Creates a failed result with an error message
  factory ConversionResult.error(String message) {
    return ConversionResult(
      success: false,
      events: [],
      errorMessage: message,
    );
  }

  /// Creates a ConversionResult from JSON response
  /// 
  /// Handles two response formats:
  /// 1. `events` array - list of event objects
  /// 2. `icsContent` string - raw ICS content that needs to be parsed
  factory ConversionResult.fromJson(Map<String, dynamic> json) {
    List<CalendarEvent> events = [];
    String? icsContent;

    // Check if response contains icsContent (raw ICS string)
    if (json['icsContent'] != null && json['icsContent'] is String) {
      icsContent = json['icsContent'] as String;
      events = IcsParser.parse(icsContent);
    } 
    // Otherwise, try to get events array
    else if (json['events'] != null && json['events'] is List) {
      final eventsJson = json['events'] as List<dynamic>;
      events = eventsJson.map((e) => CalendarEvent.fromJson(e)).toList();
    }

    return ConversionResult(
      success: json['success'] ?? events.isNotEmpty,
      events: events,
      icsContent: icsContent,
      errorMessage: json['error'] ?? json['message'],
      processingTimeMs: json['processingTimeMs'],
    );
  }

  /// Converts to JSON format
  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'events': events.map((e) => e.toJson()).toList(),
      'icsContent': icsContent,
      'errorMessage': errorMessage,
      'processingTimeMs': processingTimeMs,
    };
  }

  /// Returns the number of extracted events
  int get eventCount => events.length;

  /// Whether any events were extracted
  bool get hasEvents => events.isNotEmpty;

  @override
  String toString() {
    return 'ConversionResult(success: $success, events: ${events.length}, error: $errorMessage)';
  }
}
