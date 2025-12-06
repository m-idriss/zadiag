import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/conversion_history.dart';
import '../models/calendar_event.dart';

/// Service for managing conversion history in Firestore.
///
/// Handles CRUD operations for conversion records and provides
/// aggregated data for heatmap visualization.
class ConversionHistoryService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  /// Gets the current user ID
  String? get _userId => _auth.currentUser?.uid;

  /// Collection reference for conversion history
  CollectionReference get _conversionsCollection =>
      _firestore.collection('conversions');

  /// Saves a conversion to Firestore
  Future<void> saveConversion({
    required List<CalendarEvent> events,
    required String icsContent,
  }) async {
    if (_userId == null) {
      throw Exception('User must be authenticated to save conversions');
    }

    final conversion = ConversionHistory(
      id: '', // Will be set by Firestore
      timestamp: DateTime.now(),
      events: events,
      eventCount: events.length,
      icsContent: icsContent,
      userId: _userId!,
    );

    await _conversionsCollection.add(conversion.toFirestore());
  }

  /// Streams all conversions for the current user
  Stream<List<ConversionHistory>> streamUserConversions() {
    if (_userId == null) {
      return Stream.value([]);
    }

    return _conversionsCollection
        .where('userId', isEqualTo: _userId)
        .orderBy('timestamp', descending: true)
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map((doc) => ConversionHistory.fromFirestore(doc))
              .toList();
        });
  }

  /// Gets conversions for a specific date
  Future<List<ConversionHistory>> getConversionsForDate(DateTime date) async {
    if (_userId == null) {
      return [];
    }

    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));

    final snapshot =
        await _conversionsCollection
            .where('userId', isEqualTo: _userId)
            .where(
              'timestamp',
              isGreaterThanOrEqualTo: Timestamp.fromDate(startOfDay),
            )
            .where('timestamp', isLessThan: Timestamp.fromDate(endOfDay))
            .orderBy('timestamp', descending: true)
            .get();

    return snapshot.docs
        .map((doc) => ConversionHistory.fromFirestore(doc))
        .toList();
  }

  /// Gets conversion count for a date range (for heatmap)
  Future<Map<DateTime, int>> getConversionCountsForRange({
    required DateTime startDate,
    required DateTime endDate,
  }) async {
    if (_userId == null) {
      return {};
    }

    // Query without orderBy to avoid composite index requirement
    // We don't need ordering since we're just counting
    final snapshot =
        await _conversionsCollection
            .where('userId', isEqualTo: _userId)
            .where(
              'timestamp',
              isGreaterThanOrEqualTo: Timestamp.fromDate(startDate),
            )
            .where(
              'timestamp',
              isLessThanOrEqualTo: Timestamp.fromDate(endDate),
            )
            .get();

    final Map<DateTime, int> counts = {};

    for (final doc in snapshot.docs) {
      final conversion = ConversionHistory.fromFirestore(doc);
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
  Future<void> deleteConversion(String conversionId) async {
    await _conversionsCollection.doc(conversionId).delete();
  }

  /// Gets total conversion statistics
  Future<Map<String, int>> getStatistics() async {
    if (_userId == null) {
      return {'totalConversions': 0, 'totalEvents': 0};
    }

    final snapshot =
        await _conversionsCollection.where('userId', isEqualTo: _userId).get();

    int totalConversions = snapshot.docs.length;
    int totalEvents = 0;

    for (final doc in snapshot.docs) {
      final data = doc.data() as Map<String, dynamic>;
      totalEvents += (data['eventCount'] as int? ?? 0);
    }

    return {'totalConversions': totalConversions, 'totalEvents': totalEvents};
  }
}
