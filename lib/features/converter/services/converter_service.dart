import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/calendar_event.dart';
import '../models/conversion_result.dart';

/// Service for converting images to calendar events using the API.
class ConverterService {
  /// API endpoint for image conversion
  static const String _apiUrl = 'https://api.3dime.com/?target=converter';

  /// HTTP client for making API requests (injectable for testing)
  final http.Client _httpClient;

  /// Whether to use mock data (for testing/development when API is unavailable)
  final bool useMockData;

  /// Creates a ConverterService instance.
  /// 
  /// [httpClient] - Optional HTTP client for dependency injection (useful for testing)
  /// [useMockData] - If true, returns mock data instead of calling the API
  ConverterService({
    http.Client? httpClient,
    this.useMockData = false,
  }) : _httpClient = httpClient ?? http.Client();

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

      // Use mock data if configured or if in debug mode without network
      if (useMockData) {
        return _mockApiCall(payload);
      }

      // Make actual API call
      return _realApiCall(payload);
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

  /// Makes the actual API call to convert images.
  Future<ConversionResult> _realApiCall(Map<String, dynamic> payload) async {
    final stopwatch = Stopwatch()..start();
    
    try {
      final response = await _httpClient.post(
        Uri.parse(_apiUrl),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode(payload),
      );

      stopwatch.stop();
      final processingTimeMs = stopwatch.elapsedMilliseconds;

      if (kDebugMode) {
        print('ConverterService: API response status: ${response.statusCode}');
        print('ConverterService: API response body: ${response.body}');
        print('ConverterService: Processing time: ${processingTimeMs}ms');
      }

      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body) as Map<String, dynamic>;
        
        // Add processing time to the response
        responseData['processingTimeMs'] = processingTimeMs;
        
        return ConversionResult.fromJson(responseData);
      } else {
        // Handle error response
        String errorMessage;
        try {
          final errorData = jsonDecode(response.body) as Map<String, dynamic>;
          errorMessage = errorData['error'] ?? errorData['message'] ?? 'Unknown error';
        } catch (_) {
          errorMessage = 'Server error: ${response.statusCode}';
        }
        return ConversionResult.error(errorMessage);
      }
    } on http.ClientException catch (e) {
      return ConversionResult.error('Network error: ${e.message}');
    } catch (e) {
      return ConversionResult.error('Failed to process images: $e');
    }
  }

  /// Mock API call for development/testing when API is unavailable.
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

  /// Closes the HTTP client. Call this when the service is no longer needed.
  void dispose() {
    _httpClient.close();
  }
}
