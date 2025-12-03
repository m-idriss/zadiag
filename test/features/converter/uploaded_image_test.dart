import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:zadiag/features/converter/widgets/image_upload_zone.dart';

void main() {
  group('UploadedImage', () {
    test('isPdf returns true for PDF MIME type', () {
      final pdfFile = UploadedImage(
        bytes: Uint8List.fromList([0x25, 0x50, 0x44, 0x46]), // %PDF
        name: 'document.pdf',
        mimeType: 'application/pdf',
      );

      expect(pdfFile.isPdf, true);
      expect(pdfFile.isImage, false);
    });

    test('isImage returns true for image MIME types', () {
      final jpegFile = UploadedImage(
        bytes: Uint8List.fromList([0xFF, 0xD8, 0xFF]), // JPEG magic bytes
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
      );

      expect(jpegFile.isImage, true);
      expect(jpegFile.isPdf, false);
    });

    test('isImage returns true for PNG files', () {
      final pngFile = UploadedImage(
        bytes: Uint8List.fromList([0x89, 0x50, 0x4E, 0x47]), // PNG magic bytes
        name: 'image.png',
        mimeType: 'image/png',
      );

      expect(pngFile.isImage, true);
      expect(pngFile.isPdf, false);
    });

    test('isImage returns true for WebP files', () {
      // WebP files start with RIFF....WEBP
      final webpFile = UploadedImage(
        bytes: Uint8List.fromList([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
        name: 'image.webp',
        mimeType: 'image/webp',
      );

      expect(webpFile.isImage, true);
      expect(webpFile.isPdf, false);
    });

    test('stores bytes, name, and mimeType correctly', () {
      final bytes = Uint8List.fromList([1, 2, 3, 4, 5]);
      final file = UploadedImage(
        bytes: bytes,
        name: 'test.pdf',
        mimeType: 'application/pdf',
      );

      expect(file.bytes, bytes);
      expect(file.name, 'test.pdf');
      expect(file.mimeType, 'application/pdf');
    });
  });
}
