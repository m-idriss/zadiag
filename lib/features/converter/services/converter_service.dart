import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';

import '../models/calendar_event.dart';
import '../models/conversion_result.dart';

/// Service for converting images to calendar events using the API.
class ConverterService {
  /// API endpoint for image conversion
  static const String _apiUrl = 'https://api.3dime.com/?target=converter';

  /// Converts uploaded images to calendar events.
  ///
  /// [imageDataUrls] - List of base64 encoded image data URLs
  /// [fileNames] - List of file names corresponding to images
  /// [mimeTypes] - List of MIME types for each image
  /// [timeZone] - User's timezone (e.g., 'Europe/Paris')
  Future<ConversionResult> convertImages({
    required List<String> imageDataUrls,
    required List<String> fileNames,
    required List<String> mimeTypes,
    required String timeZone,
  }) async {
    try {
      // Build files array for request
      final files = <Map<String, String>>[];
      for (int i = 0; i < imageDataUrls.length; i++) {
        files.add({
          'dataUrl': imageDataUrls[i],
          'name': fileNames[i],
          'type': mimeTypes[i],
        });
      }

      // Build request payload
      final payload = {
        'files': files,
        'timeZone': timeZone,
        'currentDate': DateTime.now().toUtc().toIso8601String(),
      };

      // For now, return a mock response since we can't make HTTP calls
      // In production, this would use http package to make the actual API call
      return _mockApiCall(payload);
    } catch (e) {
      return ConversionResult.error('Failed to convert images: $e');
    }
  }

  /// Converts a single image bytes to calendar events.
  Future<ConversionResult> convertImageBytes({
    required Uint8List imageBytes,
    required String fileName,
    required String mimeType,
    required String timeZone,
  }) async {
    // Convert bytes to base64 data URL
    final base64Data = base64Encode(imageBytes);
    final dataUrl = 'data:$mimeType;base64,$base64Data';

    return convertImages(
      imageDataUrls: [dataUrl],
      fileNames: [fileName],
      mimeTypes: [mimeType],
      timeZone: timeZone,
    );
  }

  /// Mock API call for development/testing.
  /// In production, replace this with actual HTTP request.
  Future<ConversionResult> _mockApiCall(Map<String, dynamic> payload) async {
    // Simulate network delay
    await Future.delayed(const Duration(seconds: 2));

    // Generate mock events for demonstration
    final now = DateTime.now();
    final mockEvents = [
      CalendarEvent(
        id: '1',
        title: 'Doctor Appointment',
        description: 'Annual checkup',
        startDateTime: now.add(const Duration(days: 1, hours: 10)),
        endDateTime: now.add(const Duration(days: 1, hours: 11)),
        location: 'Medical Center, Main St',
        reminders: [30, 60],
      ),
      CalendarEvent(
        id: '2',
        title: 'Team Meeting',
        description: 'Weekly sync',
        startDateTime: now.add(const Duration(days: 2, hours: 14)),
        endDateTime: now.add(const Duration(days: 2, hours: 15)),
        location: 'Conference Room A',
        reminders: [15],
      ),
    ];

    if (kDebugMode) {
      print('ConverterService: Mock API call with payload: $payload');
      print('ConverterService: Returning ${mockEvents.length} mock events');
    }

    return ConversionResult.success(
      mockEvents,
      processingTimeMs: 2000,
    );
  }
}
