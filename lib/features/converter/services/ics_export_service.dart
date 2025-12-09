import 'dart:convert';
import 'dart:io';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:open_filex/open_filex.dart';
import 'package:zadiag/core/services/log_service.dart';

/// Service for exporting and sharing ICS files.
class IcsExportService {
  /// Default filename for exported ICS files
  static const String defaultFileName = 'calendar_events.ics';

  /// Exports the ICS content and opens it with calendar app.
  ///
  /// On mobile: Opens the calendar app directly with the ICS file.
  /// On web: Triggers a download.
  /// On desktop: Saves to Downloads folder.
  ///
  /// Returns the file path where the ICS was saved (or null on web).
  Future<String?> exportIcs(String icsContent, {String? fileName}) async {
    final effectiveFileName = fileName ?? defaultFileName;

    if (kIsWeb) {
      return _exportForWeb(icsContent, effectiveFileName);
    } else {
      return _openWithCalendar(icsContent, effectiveFileName);
    }
  }

  /// Exports ICS content for web platform using share or download.
  Future<String?> _exportForWeb(String icsContent, String fileName) async {
    try {
      // Try to use the Web Share API if available
      final result = await Share.shareXFiles([
        XFile.fromData(
          utf8.encode(icsContent),
          mimeType: 'text/calendar',
          name: fileName,
        ),
      ]);

      if (result.status == ShareResultStatus.success) {
        return null;
      }

      // Fallback: Create a download link
      final bytes = utf8.encode(icsContent);
      final base64Data = base64Encode(bytes);
      final dataUrl = 'data:text/calendar;charset=utf-8;base64,$base64Data';

      // Note: This will trigger a download in the browser
      await Share.share(dataUrl);
      return null;
    } catch (e, stack) {
      Log.e('IcsExportService: Error exporting ICS for web', e, stack);
      rethrow;
    }
  }

  /// Opens ICS file directly with calendar app on native platforms.
  ///
  /// Creates a temporary file and attempts to open it with the system calendar.
  Future<String?> _openWithCalendar(String icsContent, String fileName) async {
    try {
      // Get the temporary directory
      final directory = await getTemporaryDirectory();

      // Create the file path in temp directory
      final filePath = '${directory.path}/$fileName';
      final file = File(filePath);

      // Write the ICS content to the file
      await file.writeAsString(icsContent, flush: true);

      Log.d('IcsExportService: ICS file created at: $filePath');

      // Try to open the file directly with the calendar app using OpenFilex
      try {
        final result = await OpenFilex.open(
          filePath,
          type: 'text/calendar',
          uti: 'com.apple.ical.ics', // iOS-specific uniform type identifier
        );

        Log.d(
          'IcsExportService: OpenFilex result: ${result.type} - ${result.message}',
        );

        // Check if file opened successfully
        if (result.type == ResultType.done) {
          return filePath;
        }

        // If opening failed, fall back to share sheet
        Log.w(
          'IcsExportService: OpenFilex failed with: ${result.type}, falling back to share',
        );

        await Share.shareXFiles(
          [XFile(filePath, mimeType: 'text/calendar')],
          subject: 'Add Calendar Events',
          sharePositionOrigin: const Rect.fromLTWH(0, 0, 100, 100),
        );
      } catch (e, stack) {
        Log.e(
          'IcsExportService: Error opening file, falling back to share',
          e,
          stack,
        );

        // Fallback to share if direct launch fails
        await Share.shareXFiles(
          [XFile(filePath, mimeType: 'text/calendar')],
          subject: 'Add Calendar Events',
          sharePositionOrigin: const Rect.fromLTWH(0, 0, 100, 100),
        );
      }

      // Return the file path for reference
      return filePath;
    } catch (e, stack) {
      Log.e('IcsExportService: Error opening ICS for native', e, stack);
      rethrow;
    }
  }

  /// Opens the ICS file with the default calendar application.
  ///
  /// Note: This method is deprecated in favor of direct opening.
  /// Kept for backwards compatibility.
  @Deprecated("Use exportIcs or shareIcs instead")
  Future<bool> openIcsFile(String filePath) async {
    try {
      // Just share the file instead
      await Share.shareXFiles([XFile(filePath, mimeType: 'text/calendar')]);
      return true;
    } catch (e, stack) {
      Log.e('IcsExportService: Error opening ICS file', e, stack);
      return false;
    }
  }

  /// Shares the ICS content using the system share sheet.
  ///
  /// This is now the primary method for exporting ICS files.
  Future<String?> shareIcs(String icsContent, {String? fileName}) async {
    return exportIcs(icsContent, fileName: fileName);
  }

  /// Gets a unique filename with timestamp to avoid conflicts.
  String getUniqueFileName() {
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return 'calendar_events_$timestamp.ics';
  }
}
