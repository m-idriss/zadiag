import 'dart:io';
import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';
import 'package:zadiag/core/services/isar_service.dart';
import '../models/conversion_history.dart';
import '../models/calendar_event.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:zadiag/core/services/log_service.dart';

/// Service for managing conversion history in Isar.
class ConversionHistoryService {
  final IsarService _isarService = IsarService();
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String? get _userId => _auth.currentUser?.uid;

  /// Saves a conversion to Isar
  Future<void> saveConversion({
    required List<CalendarEvent> events,
    required String icsContent,
    List<String> originalFilePaths = const [],
  }) async {
    if (_userId == null) {
      throw Exception('User must be authenticated to save conversions');
    }

    // Copy files to permanent storage
    final List<String> savedPaths = [];
    if (originalFilePaths.isNotEmpty) {
      try {
        final appDir = await getApplicationDocumentsDirectory();
        final conversionsDir = Directory('${appDir.path}/conversions');
        if (!await conversionsDir.exists()) {
          await conversionsDir.create(recursive: true);
        }

        for (final path in originalFilePaths) {
          final file = File(path);
          if (await file.exists()) {
            final fileName =
                '${DateTime.now().millisecondsSinceEpoch}_${path.split('/').last}';
            final newPath = '${conversionsDir.path}/$fileName';
            await file.copy(newPath);
            savedPaths.add(newPath);
          }
        }
      } catch (e) {
        Log.e('Error saving original files: $e');
        // Continue even if file saving fails
      }
    }

    final isar = await _isarService.db;
    final conversion = ConversionHistory(
      timestamp: DateTime.now(),
      events: events,
      eventCount: events.length,
      icsContent: icsContent,
      userId: _userId!,
      originalFilePaths: savedPaths,
    );

    await isar.writeTxn(() async {
      await isar.conversionHistorys.put(conversion);
    });
  }

  /// Streams all conversions for the current user
  Stream<List<ConversionHistory>> streamUserConversions() async* {
    if (_userId == null) {
      yield [];
      return;
    }

    final isar = await _isarService.db;
    yield* isar.conversionHistorys
        .where()
        .userIdEqualTo(_userId!)
        .sortByTimestampDesc()
        .watch(fireImmediately: true);
  }

  /// Gets conversions for a specific date
  Future<List<ConversionHistory>> getConversionsForDate(DateTime date) async {
    if (_userId == null) {
      return [];
    }

    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));

    final isar = await _isarService.db;
    return await isar.conversionHistorys
        .where()
        .userIdEqualTo(_userId!)
        .filter()
        .timestampGreaterThan(startOfDay, include: true)
        .timestampLessThan(endOfDay)
        .sortByTimestampDesc()
        .findAll();
  }

  /// Gets conversion count for a date range (for heatmap)
  Future<Map<DateTime, int>> getConversionCountsForRange({
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    if (_userId == null) {
      return {};
    }

    final isar = await _isarService.db;
    final conversions =
        await isar.conversionHistorys
            .where()
            .userIdEqualTo(_userId!)
            .filter()
            .timestampGreaterThan(startDate, include: true)
            .timestampLessThan(endDate, include: true)
            .findAll();

    final Map<DateTime, int> counts = {};

    for (final conversion in conversions) {
      final date = DateTime(
        conversion.timestamp.year,
        conversion.timestamp.month,
        conversion.timestamp.day,
      );
      counts[date] = (counts[date] ?? 0) + 1;
    }

    return counts;
  }

  /// Deletes a conversion record and its associated files
  Future<void> deleteConversion(int conversionId) async {
    final isar = await _isarService.db;

    // Get conversion to find file paths
    final conversion = await isar.conversionHistorys.get(conversionId);
    if (conversion != null) {
      // Delete physical files
      for (final path in conversion.originalFilePaths) {
        try {
          final file = File(path);
          if (await file.exists()) {
            await file.delete();
          }
        } catch (e) {
          Log.e('Error deleting file $path: $e');
        }
      }
    }

    // Delete record
    await isar.writeTxn(() async {
      await isar.conversionHistorys.delete(conversionId);
    });
  }

  /// Gets total conversion statistics
  Future<Map<String, int>> getStatistics() async {
    if (_userId == null) {
      return {'totalConversions': 0, 'totalEvents': 0};
    }

    final isar = await _isarService.db;
    final conversions =
        await isar.conversionHistorys.where().userIdEqualTo(_userId!).findAll();

    final totalConversions = conversions.length;
    final totalEvents = conversions.fold<int>(
      0,
      (sum, item) => sum + item.eventCount,
    );

    return {'totalConversions': totalConversions, 'totalEvents': totalEvents};
  }

  /// Clears all conversion history and deletes files
  Future<void> clearAllHistory() async {
    if (_userId == null) {
      throw Exception('User must be authenticated to clear history');
    }

    final isar = await _isarService.db;
    final conversions =
        await isar.conversionHistorys.where().userIdEqualTo(_userId!).findAll();

    // 1. Delete physical files
    for (final conversion in conversions) {
      for (final path in conversion.originalFilePaths) {
        try {
          final file = File(path);
          if (await file.exists()) {
            await file.delete();
          }
        } catch (e) {
          Log.e('Error deleting file $path: $e');
          // Continue deleting other files even if one fails
        }
      }
    }

    // 2. Delete database records
    await isar.writeTxn(() async {
      await isar.conversionHistorys.where().userIdEqualTo(_userId!).deleteAll();
    });

    Log.d('Cleared all history for user $_userId');
  }
}
