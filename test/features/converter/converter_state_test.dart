import 'dart:typed_data';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/providers/converter_state.dart';
import 'package:zadiag/features/converter/widgets/image_upload_zone.dart';

void main() {
  group('ConverterState', () {
    test('initial state has empty lists and false flags', () {
      const state = ConverterState();
      
      expect(state.uploadedImages, isEmpty);
      expect(state.extractedEvents, isEmpty);
      expect(state.isProcessing, false);
      expect(state.isExporting, false);
      expect(state.errorMessage, isNull);
      expect(state.generatedIcs, isNull);
      expect(state.hasEvents, false);
    });

    test('copyWith creates a new state with updated values', () {
      const state = ConverterState();
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Test Event',
          startDateTime: DateTime(2024, 1, 15, 10),
          endDateTime: DateTime(2024, 1, 15, 11),
        ),
      ];
      
      final newState = state.copyWith(
        extractedEvents: events,
        isProcessing: true,
      );
      
      expect(newState.extractedEvents, events);
      expect(newState.isProcessing, true);
      expect(newState.uploadedImages, isEmpty);
    });

    test('copyWith with clearError removes error message', () {
      final state = ConverterState(
        errorMessage: 'Some error',
      );
      
      final newState = state.copyWith(clearError: true);
      
      expect(newState.errorMessage, isNull);
    });

    test('copyWith with clearIcs removes generated ICS', () {
      final state = ConverterState(
        generatedIcs: 'BEGIN:VCALENDAR...',
      );
      
      final newState = state.copyWith(clearIcs: true);
      
      expect(newState.generatedIcs, isNull);
    });

    test('hasEvents returns true when events exist', () {
      final state = ConverterState(
        extractedEvents: [
          CalendarEvent(
            id: '1',
            title: 'Test Event',
            startDateTime: DateTime(2024, 1, 15, 10),
            endDateTime: DateTime(2024, 1, 15, 11),
          ),
        ],
      );
      
      expect(state.hasEvents, true);
    });
  });

  group('ConverterNotifier', () {
    late ProviderContainer container;
    late ConverterNotifier notifier;

    setUp(() {
      container = ProviderContainer();
      notifier = container.read(converterProvider.notifier);
    });

    tearDown(() {
      container.dispose();
    });

    test('setUploadedImages updates the uploaded images', () {
      final images = [
        UploadedImage(
          bytes: Uint8List.fromList([1, 2, 3]),
          name: 'test.jpg',
          mimeType: 'image/jpeg',
        ),
      ];
      
      notifier.setUploadedImages(images);
      
      final state = container.read(converterProvider);
      expect(state.uploadedImages.length, 1);
      expect(state.uploadedImages.first.name, 'test.jpg');
    });

    test('setUploadedImages with empty list clears events and errors', () {
      // First set some state
      notifier.setConversionResult(
        events: [
          CalendarEvent(
            id: '1',
            title: 'Test Event',
            startDateTime: DateTime(2024, 1, 15, 10),
            endDateTime: DateTime(2024, 1, 15, 11),
          ),
        ],
        icsContent: 'BEGIN:VCALENDAR...',
        errorMessage: null,
      );
      notifier.setError('Some error');
      
      // Then clear with empty images
      notifier.setUploadedImages([]);
      
      final state = container.read(converterProvider);
      expect(state.extractedEvents, isEmpty);
      expect(state.generatedIcs, isNull);
      expect(state.errorMessage, isNull);
    });

    test('setProcessing updates the processing flag', () {
      notifier.setProcessing(true);
      expect(container.read(converterProvider).isProcessing, true);
      
      notifier.setProcessing(false);
      expect(container.read(converterProvider).isProcessing, false);
    });

    test('setExporting updates the exporting flag', () {
      notifier.setExporting(true);
      expect(container.read(converterProvider).isExporting, true);
      
      notifier.setExporting(false);
      expect(container.read(converterProvider).isExporting, false);
    });

    test('prepareForConversion sets processing and clears error/ics', () {
      // Set initial state with error and ics
      notifier.setConversionResult(
        events: [],
        icsContent: 'BEGIN:VCALENDAR...',
        errorMessage: 'Some error',
      );
      
      notifier.prepareForConversion();
      
      final state = container.read(converterProvider);
      expect(state.isProcessing, true);
      expect(state.errorMessage, isNull);
      expect(state.generatedIcs, isNull);
    });

    test('setConversionResult updates events and ics content', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Test Event',
          startDateTime: DateTime(2024, 1, 15, 10),
          endDateTime: DateTime(2024, 1, 15, 11),
        ),
      ];
      
      notifier.setConversionResult(
        events: events,
        icsContent: 'BEGIN:VCALENDAR...',
      );
      
      final state = container.read(converterProvider);
      expect(state.extractedEvents.length, 1);
      expect(state.generatedIcs, 'BEGIN:VCALENDAR...');
      expect(state.isProcessing, false);
    });

    test('setError updates error message and stops processing', () {
      notifier.setProcessing(true);
      notifier.setError('Test error');
      
      final state = container.read(converterProvider);
      expect(state.errorMessage, 'Test error');
      expect(state.isProcessing, false);
    });

    test('removeEvent removes event at specified index', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event 1',
          startDateTime: DateTime(2024, 1, 15, 10),
          endDateTime: DateTime(2024, 1, 15, 11),
        ),
        CalendarEvent(
          id: '2',
          title: 'Event 2',
          startDateTime: DateTime(2024, 1, 16, 10),
          endDateTime: DateTime(2024, 1, 16, 11),
        ),
      ];
      
      notifier.setConversionResult(
        events: events,
        icsContent: 'BEGIN:VCALENDAR...',
      );
      
      notifier.removeEvent(0);
      
      final state = container.read(converterProvider);
      expect(state.extractedEvents.length, 1);
      expect(state.extractedEvents.first.title, 'Event 2');
      expect(state.generatedIcs, isNull); // ICS should be cleared
    });

    test('removeEvent with invalid index does nothing', () {
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Event 1',
          startDateTime: DateTime(2024, 1, 15, 10),
          endDateTime: DateTime(2024, 1, 15, 11),
        ),
      ];
      
      notifier.setConversionResult(
        events: events,
        icsContent: 'BEGIN:VCALENDAR...',
      );
      
      notifier.removeEvent(5); // Invalid index
      
      final state = container.read(converterProvider);
      expect(state.extractedEvents.length, 1);
    });

    test('setGeneratedIcs updates the generated ICS content', () {
      notifier.setGeneratedIcs('BEGIN:VCALENDAR\nVERSION:2.0...');
      
      final state = container.read(converterProvider);
      expect(state.generatedIcs, 'BEGIN:VCALENDAR\nVERSION:2.0...');
    });

    test('clear resets all state to initial values', () {
      // Set up some state
      notifier.setConversionResult(
        events: [
          CalendarEvent(
            id: '1',
            title: 'Event 1',
            startDateTime: DateTime(2024, 1, 15, 10),
            endDateTime: DateTime(2024, 1, 15, 11),
          ),
        ],
        icsContent: 'BEGIN:VCALENDAR...',
      );
      notifier.setError('Some error');
      notifier.setProcessing(true);
      
      // Clear all state
      notifier.clear();
      
      final state = container.read(converterProvider);
      expect(state.uploadedImages, isEmpty);
      expect(state.extractedEvents, isEmpty);
      expect(state.isProcessing, false);
      expect(state.isExporting, false);
      expect(state.errorMessage, isNull);
      expect(state.generatedIcs, isNull);
    });

    test('state persists across multiple operations', () {
      // Simulate a conversion workflow
      final images = [
        UploadedImage(
          bytes: Uint8List.fromList([1, 2, 3]),
          name: 'test.jpg',
          mimeType: 'image/jpeg',
        ),
      ];
      
      // Upload images
      notifier.setUploadedImages(images);
      expect(container.read(converterProvider).uploadedImages.length, 1);
      
      // Prepare for conversion
      notifier.prepareForConversion();
      expect(container.read(converterProvider).isProcessing, true);
      
      // Complete conversion with results
      final events = [
        CalendarEvent(
          id: '1',
          title: 'Test Event',
          startDateTime: DateTime(2024, 1, 15, 10),
          endDateTime: DateTime(2024, 1, 15, 11),
        ),
      ];
      notifier.setConversionResult(
        events: events,
        icsContent: 'BEGIN:VCALENDAR...',
      );
      
      // Verify final state - this simulates navigation away and back
      final finalState = container.read(converterProvider);
      expect(finalState.uploadedImages.length, 1);
      expect(finalState.extractedEvents.length, 1);
      expect(finalState.generatedIcs, isNotNull);
      expect(finalState.isProcessing, false);
    });
  });
}
