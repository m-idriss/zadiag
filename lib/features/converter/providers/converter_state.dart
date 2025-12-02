import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/calendar_event.dart';
import '../widgets/image_upload_zone.dart';

/// Represents the state of the Converter page.
/// This state persists across navigation, ensuring events
/// remain visible until a new conversion is triggered.
@immutable
class ConverterState {
  /// List of uploaded images
  final List<UploadedImage> uploadedImages;

  /// List of extracted calendar events
  final List<CalendarEvent> extractedEvents;

  /// Whether a conversion is in progress
  final bool isProcessing;

  /// Whether an export is in progress
  final bool isExporting;

  /// Error message if any error occurred
  final String? errorMessage;

  /// Generated ICS content
  final String? generatedIcs;

  const ConverterState({
    this.uploadedImages = const [],
    this.extractedEvents = const [],
    this.isProcessing = false,
    this.isExporting = false,
    this.errorMessage,
    this.generatedIcs,
  });

  /// Creates a copy of this state with the given changes.
  ConverterState copyWith({
    List<UploadedImage>? uploadedImages,
    List<CalendarEvent>? extractedEvents,
    bool? isProcessing,
    bool? isExporting,
    String? errorMessage,
    String? generatedIcs,
    bool clearError = false,
    bool clearIcs = false,
  }) {
    return ConverterState(
      uploadedImages: uploadedImages ?? this.uploadedImages,
      extractedEvents: extractedEvents ?? this.extractedEvents,
      isProcessing: isProcessing ?? this.isProcessing,
      isExporting: isExporting ?? this.isExporting,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      generatedIcs: clearIcs ? null : (generatedIcs ?? this.generatedIcs),
    );
  }

  /// Returns true if there are extracted events
  bool get hasEvents => extractedEvents.isNotEmpty;
}

/// Notifier that manages the converter page state.
class ConverterNotifier extends Notifier<ConverterState> {
  @override
  ConverterState build() {
    return const ConverterState();
  }

  /// Updates the uploaded images.
  void setUploadedImages(List<UploadedImage> images) {
    if (images.isEmpty) {
      state = state.copyWith(
        uploadedImages: images,
        extractedEvents: [],
        clearError: true,
        clearIcs: true,
      );
    } else {
      state = state.copyWith(uploadedImages: images);
    }
  }

  /// Sets the processing state.
  void setProcessing(bool isProcessing) {
    state = state.copyWith(isProcessing: isProcessing);
  }

  /// Sets the exporting state.
  void setExporting(bool isExporting) {
    state = state.copyWith(isExporting: isExporting);
  }

  /// Clears error and ICS before a new conversion.
  void prepareForConversion() {
    state = state.copyWith(
      isProcessing: true,
      clearError: true,
      clearIcs: true,
    );
  }

  /// Sets the conversion results.
  void setConversionResult({
    required List<CalendarEvent> events,
    String? icsContent,
    String? errorMessage,
  }) {
    state = state.copyWith(
      extractedEvents: events,
      generatedIcs: icsContent,
      errorMessage: errorMessage,
      isProcessing: false,
    );
  }

  /// Sets an error message.
  void setError(String errorMessage) {
    state = state.copyWith(
      errorMessage: errorMessage,
      isProcessing: false,
    );
  }

  /// Removes an event at the given index.
  void removeEvent(int index) {
    final newEvents = List<CalendarEvent>.from(state.extractedEvents);
    if (index >= 0 && index < newEvents.length) {
      newEvents.removeAt(index);
      state = state.copyWith(
        extractedEvents: newEvents,
        clearIcs: true,
      );
    }
  }

  /// Sets the generated ICS content.
  void setGeneratedIcs(String icsContent) {
    state = state.copyWith(generatedIcs: icsContent);
  }

  /// Clears all state (uploaded images, events, errors).
  void clear() {
    state = const ConverterState();
  }
}

/// Provider for the converter state.
final converterProvider =
    NotifierProvider<ConverterNotifier, ConverterState>(ConverterNotifier.new);
