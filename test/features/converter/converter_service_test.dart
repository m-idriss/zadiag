import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zadiag/features/converter/services/converter_service.dart';

void main() {
  group('ConverterService', () {
    group('with mock data', () {
      late ConverterService service;

      setUp(() {
        service = ConverterService(useMockData: true);
      });

      tearDown(() {
        service.dispose();
      });

      test('returns mock events when useMockData is true', () async {
        final result = await service.convertImages(
          imageDataUrls: ['data:image/jpeg;base64,/9j/4AAQSkZ...'],
          fileNames: ['test.jpg'],
          mimeTypes: ['image/jpeg'],
          timeZone: 'UTC',
        );

        expect(result.success, true);
        expect(result.hasEvents, true);
        expect(result.events.length, 2);
        expect(result.events[0].title, 'Doctor Appointment');
        expect(result.events[1].title, 'Team Meeting');
      });

      test('convertImageBytes works correctly', () async {
        final bytes = utf8.encode('test image data');
        final result = await service.convertImageBytes(
          imageBytes: bytes,
          fileName: 'test.jpg',
          mimeType: 'image/jpeg',
          timeZone: 'Europe/Paris',
        );

        expect(result.success, true);
        expect(result.hasEvents, true);
      });
    });

    group('with real API', () {
      test('handles successful API response', () async {
        final mockClient = MockClient((request) async {
          expect(request.url.toString(), 'https://api.3dime.com/?target=converter');
          expect(request.method, 'POST');
          expect(request.headers['Content-Type'], 'application/json');

          return http.Response(
            jsonEncode({
              'success': true,
              'events': [
                {
                  'id': '1',
                  'title': 'Test Event',
                  'startDateTime': '2024-01-15T10:00:00.000Z',
                  'endDateTime': '2024-01-15T11:00:00.000Z',
                  'description': 'Test description',
                  'location': 'Test location',
                }
              ],
            }),
            200,
          );
        });

        final service = ConverterService(httpClient: mockClient);

        final result = await service.convertImages(
          imageDataUrls: ['data:image/jpeg;base64,/9j/4AAQSkZ...'],
          fileNames: ['test.jpg'],
          mimeTypes: ['image/jpeg'],
          timeZone: 'UTC',
        );

        expect(result.success, true);
        expect(result.events.length, 1);
        expect(result.events[0].title, 'Test Event');
        expect(result.events[0].description, 'Test description');
        expect(result.events[0].location, 'Test location');

        service.dispose();
      });

      test('handles API error response', () async {
        final mockClient = MockClient((request) async {
          return http.Response(
            jsonEncode({
              'success': false,
              'error': 'Invalid image format',
            }),
            400,
          );
        });

        final service = ConverterService(httpClient: mockClient);

        final result = await service.convertImages(
          imageDataUrls: ['data:image/jpeg;base64,invalid'],
          fileNames: ['test.jpg'],
          mimeTypes: ['image/jpeg'],
          timeZone: 'UTC',
        );

        expect(result.success, false);
        expect(result.errorMessage, 'Invalid image format');

        service.dispose();
      });

      test('handles network error', () async {
        final mockClient = MockClient((request) async {
          throw http.ClientException('Network unavailable');
        });

        final service = ConverterService(httpClient: mockClient);

        final result = await service.convertImages(
          imageDataUrls: ['data:image/jpeg;base64,/9j/4AAQSkZ...'],
          fileNames: ['test.jpg'],
          mimeTypes: ['image/jpeg'],
          timeZone: 'UTC',
        );

        expect(result.success, false);
        expect(result.errorMessage, contains('Network error'));

        service.dispose();
      });

      test('handles server error (500)', () async {
        final mockClient = MockClient((request) async {
          return http.Response('Internal Server Error', 500);
        });

        final service = ConverterService(httpClient: mockClient);

        final result = await service.convertImages(
          imageDataUrls: ['data:image/jpeg;base64,/9j/4AAQSkZ...'],
          fileNames: ['test.jpg'],
          mimeTypes: ['image/jpeg'],
          timeZone: 'UTC',
        );

        expect(result.success, false);
        expect(result.errorMessage, contains('500'));

        service.dispose();
      });

      test('includes processing time in result', () async {
        final mockClient = MockClient((request) async {
          await Future.delayed(const Duration(milliseconds: 100));
          return http.Response(
            jsonEncode({
              'success': true,
              'events': [],
            }),
            200,
          );
        });

        final service = ConverterService(httpClient: mockClient);

        final result = await service.convertImages(
          imageDataUrls: ['data:image/jpeg;base64,/9j/4AAQSkZ...'],
          fileNames: ['test.jpg'],
          mimeTypes: ['image/jpeg'],
          timeZone: 'UTC',
        );

        expect(result.processingTimeMs, greaterThan(0));

        service.dispose();
      });

      test('sends correct request payload', () async {
        Map<String, dynamic>? capturedPayload;

        final mockClient = MockClient((request) async {
          capturedPayload = jsonDecode(request.body);
          return http.Response(
            jsonEncode({'success': true, 'events': []}),
            200,
          );
        });

        final service = ConverterService(httpClient: mockClient);

        await service.convertImages(
          imageDataUrls: ['data:image/jpeg;base64,abc123'],
          fileNames: ['photo.jpg'],
          mimeTypes: ['image/jpeg'],
          timeZone: 'America/New_York',
        );

        expect(capturedPayload, isNotNull);
        expect(capturedPayload!['timeZone'], 'America/New_York');
        expect(capturedPayload!['files'], hasLength(1));
        expect(capturedPayload!['files'][0]['dataUrl'], 'data:image/jpeg;base64,abc123');
        expect(capturedPayload!['files'][0]['name'], 'photo.jpg');
        expect(capturedPayload!['files'][0]['type'], 'image/jpeg');
        expect(capturedPayload!['currentDate'], isNotNull);

        service.dispose();
      });

      test('handles multiple images', () async {
        final mockClient = MockClient((request) async {
          final payload = jsonDecode(request.body);
          expect(payload['files'], hasLength(3));
          return http.Response(
            jsonEncode({
              'success': true,
              'events': [
                {
                  'id': '1',
                  'title': 'Event 1',
                  'startDateTime': '2024-01-15T10:00:00.000Z',
                  'endDateTime': '2024-01-15T11:00:00.000Z',
                },
                {
                  'id': '2',
                  'title': 'Event 2',
                  'startDateTime': '2024-01-16T10:00:00.000Z',
                  'endDateTime': '2024-01-16T11:00:00.000Z',
                },
              ],
            }),
            200,
          );
        });

        final service = ConverterService(httpClient: mockClient);

        final result = await service.convertImages(
          imageDataUrls: [
            'data:image/jpeg;base64,img1',
            'data:image/png;base64,img2',
            'data:image/webp;base64,img3',
          ],
          fileNames: ['img1.jpg', 'img2.png', 'img3.webp'],
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          timeZone: 'UTC',
        );

        expect(result.success, true);
        expect(result.events.length, 2);

        service.dispose();
      });

      test('handles PDF files correctly', () async {
        Map<String, dynamic>? capturedPayload;

        final mockClient = MockClient((request) async {
          capturedPayload = jsonDecode(request.body);
          return http.Response(
            jsonEncode({
              'success': true,
              'events': [
                {
                  'id': '1',
                  'title': 'PDF Event',
                  'startDateTime': '2024-01-15T10:00:00.000Z',
                  'endDateTime': '2024-01-15T11:00:00.000Z',
                },
              ],
            }),
            200,
          );
        });

        final service = ConverterService(httpClient: mockClient);

        final result = await service.convertImages(
          imageDataUrls: ['data:application/pdf;base64,JVBERi0xLjQK'],
          fileNames: ['document.pdf'],
          mimeTypes: ['application/pdf'],
          timeZone: 'UTC',
        );

        expect(result.success, true);
        expect(result.events.length, 1);
        expect(result.events[0].title, 'PDF Event');
        expect(capturedPayload!['files'][0]['type'], 'application/pdf');
        expect(capturedPayload!['files'][0]['name'], 'document.pdf');

        service.dispose();
      });

      test('handles mixed images and PDFs', () async {
        final mockClient = MockClient((request) async {
          final payload = jsonDecode(request.body);
          expect(payload['files'], hasLength(2));
          return http.Response(
            jsonEncode({
              'success': true,
              'events': [
                {
                  'id': '1',
                  'title': 'Event from Image',
                  'startDateTime': '2024-01-15T10:00:00.000Z',
                  'endDateTime': '2024-01-15T11:00:00.000Z',
                },
                {
                  'id': '2',
                  'title': 'Event from PDF',
                  'startDateTime': '2024-01-16T10:00:00.000Z',
                  'endDateTime': '2024-01-16T11:00:00.000Z',
                },
              ],
            }),
            200,
          );
        });

        final service = ConverterService(httpClient: mockClient);

        final result = await service.convertImages(
          imageDataUrls: [
            'data:image/jpeg;base64,img1',
            'data:application/pdf;base64,JVBERi0xLjQK',
          ],
          fileNames: ['photo.jpg', 'document.pdf'],
          mimeTypes: ['image/jpeg', 'application/pdf'],
          timeZone: 'UTC',
        );

        expect(result.success, true);
        expect(result.events.length, 2);

        service.dispose();
      });
    });
  });
}
