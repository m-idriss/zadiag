import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

/// Service for exporting ICS files to various destinations.
class IcsExportService {
  /// Default filename for exported ICS files
  static const String defaultFileName = 'calendar_events.ics';

  /// Exports the ICS content as a downloadable file.
  /// 
  /// On web: Opens a download dialog in the browser.
  /// On mobile/desktop: Saves to the downloads directory and optionally opens it.
  /// 
  /// Returns the file path where the ICS was saved (or null on web).
  Future<String?> exportIcs(String icsContent, {String? fileName}) async {
    final effectiveFileName = fileName ?? defaultFileName;

    if (kIsWeb) {
      return _exportForWeb(icsContent, effectiveFileName);
    } else {
      return _exportForNative(icsContent, effectiveFileName);
    }
  }

  /// Exports ICS content for web platform using a data URL.
  Future<String?> _exportForWeb(String icsContent, String fileName) async {
    try {
      // Create a data URL for the ICS content
      final bytes = utf8.encode(icsContent);
      final base64Data = base64Encode(bytes);
      final dataUrl = 'data:text/calendar;charset=utf-8;base64,$base64Data';

      // Launch the data URL which will trigger a download in browsers
      final uri = Uri.parse(dataUrl);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
        return null; // Web downloads don't return a path
      } else {
        throw Exception('Could not launch download URL');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error exporting ICS for web: $e');
      }
      rethrow;
    }
  }

  /// Exports ICS content for native platforms (mobile/desktop).
  Future<String?> _exportForNative(String icsContent, String fileName) async {
    try {
      // Get the appropriate directory for downloads
      Directory? directory;
      
      if (Platform.isAndroid) {
        // On Android, use external storage downloads directory if available
        directory = await getExternalStorageDirectory();
        directory ??= await getApplicationDocumentsDirectory();
      } else if (Platform.isIOS) {
        // On iOS, use the documents directory
        directory = await getApplicationDocumentsDirectory();
      } else {
        // On desktop, try to use downloads directory, fall back to documents
        directory = await getDownloadsDirectory();
        directory ??= await getApplicationDocumentsDirectory();
      }

      // Create the file path
      final filePath = '${directory.path}/$fileName';
      final file = File(filePath);

      // Write the ICS content to the file
      await file.writeAsString(icsContent, flush: true);

      if (kDebugMode) {
        print('ICS file saved to: $filePath');
      }

      return filePath;
    } catch (e) {
      if (kDebugMode) {
        print('Error exporting ICS for native: $e');
      }
      rethrow;
    }
  }

  /// Opens the ICS file with the default calendar application.
  /// 
  /// This uses the file:// URL scheme on native platforms.
  /// Returns true if the file was successfully opened.
  Future<bool> openIcsFile(String filePath) async {
    try {
      final uri = Uri.file(filePath);
      if (await canLaunchUrl(uri)) {
        return await launchUrl(uri);
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        print('Error opening ICS file: $e');
      }
      return false;
    }
  }

  /// Shares the ICS content using the system share sheet.
  /// 
  /// Note: This requires the share_plus package for full functionality.
  /// For now, this creates a temp file and attempts to open it.
  Future<String?> shareIcs(String icsContent, {String? fileName}) async {
    // Save the file first
    final filePath = await exportIcs(icsContent, fileName: fileName);
    
    if (filePath != null) {
      // Attempt to open the file (which may trigger share on some platforms)
      await openIcsFile(filePath);
    }
    
    return filePath;
  }

  /// Gets a unique filename with timestamp to avoid conflicts.
  String getUniqueFileName() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return 'calendar_events_$timestamp.ics';
  }
}
