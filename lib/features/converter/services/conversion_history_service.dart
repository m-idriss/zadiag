import 'package:isar/isar.dart';
import 'package:zadiag/core/services/isar_service.dart';
import '../models/conversion_history.dart';
import '../models/calendar_event.dart';
import 'package:firebase_auth/firebase_auth.dart';

/// Service for managing conversion history in Isar.
class ConversionHistoryService {
  final IsarService _isarService = IsarService();
  final FirebaseAuth _auth = FirebaseAuth.instance;

  String? get _userId => _auth.currentUser?.uid;

  /// Saves a conversion to Isar
  Future<void> saveConversion({
    required List<CalendarEvent> events,
    required String icsContent,
  }) async {
    if (_userId == null) {
      throw Exception('User must be authenticated to save conversions');
    }

    final isar = await _isarService.db;
    final conversion = ConversionHistory(
      timestamp: DateTime.now(),
      events: events,
      eventCount: events.length,
      icsContent: icsContent,
      userId: _userId!,
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

  /// Deletes a conversion record
  Future<void> deleteConversion(int conversionId) async {
    final isar = await _isarService.db;
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
}
