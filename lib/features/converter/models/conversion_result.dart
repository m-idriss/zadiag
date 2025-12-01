import 'calendar_event.dart';

/// Model representing the result of image to calendar conversion.
class ConversionResult {
  /// Whether the conversion was successful
  final bool success;

  /// List of extracted calendar events
  final List<CalendarEvent> events;

  /// Error message if conversion failed
  final String? errorMessage;

  /// Processing time in milliseconds
  final int? processingTimeMs;

  ConversionResult({
    required this.success,
    required this.events,
    this.errorMessage,
    this.processingTimeMs,
  });

  /// Creates a successful result with events
  factory ConversionResult.success(List<CalendarEvent> events,
      {int? processingTimeMs}) {
    return ConversionResult(
      success: true,
      events: events,
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
  factory ConversionResult.fromJson(Map<String, dynamic> json) {
    final eventsJson = json['events'] as List<dynamic>? ?? [];
    final events =
        eventsJson.map((e) => CalendarEvent.fromJson(e)).toList();

    return ConversionResult(
      success: json['success'] ?? events.isNotEmpty,
      events: events,
      errorMessage: json['error'] ?? json['message'],
      processingTimeMs: json['processingTimeMs'],
    );
  }

  /// Converts to JSON format
  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'events': events.map((e) => e.toJson()).toList(),
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
