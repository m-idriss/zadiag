import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/conversion_history.dart';
import '../services/conversion_history_service.dart';

/// Provider for the conversion history service
final conversionHistoryServiceProvider = Provider<ConversionHistoryService>((
  ref,
) {
  return ConversionHistoryService();
});

/// Provider that streams all conversions for the current user
final conversionHistoryStreamProvider = StreamProvider<List<ConversionHistory>>(
  (ref) {
    final service = ref.watch(conversionHistoryServiceProvider);
    return service.streamUserConversions();
  },
);

/// Provider for heatmap data based on conversion history
final conversionHeatmapDataProvider = FutureProvider<Map<DateTime, int>>((
  ref,
) async {
  // Watch the stream provider to automatically update when data changes
  final conversionsAsync = ref.watch(conversionHistoryStreamProvider);
  final conversions = conversionsAsync.value ?? [];

  // Get data for the last 365 days
  final endDate = DateTime.now();
  final startDate = endDate.subtract(const Duration(days: 365));

  final Map<DateTime, int> counts = {};

  for (final conversion in conversions) {
    if (conversion.timestamp.isAfter(startDate)) {
      final date = DateTime(
        conversion.timestamp.year,
        conversion.timestamp.month,
        conversion.timestamp.day,
      );
      counts[date] = (counts[date] ?? 0) + 1;
    }
  }

  // Normalize counts to 0-4 scale for heatmap
  if (counts.isEmpty) {
    return {};
  }

  final maxCount = counts.values.reduce((a, b) => a > b ? a : b);
  if (maxCount == 0) {
    return {};
  }
  final Map<DateTime, int> heatmapData = {};

  for (final entry in counts.entries) {
    // Scale to 1-4 based on relative activity
    final normalized = ((entry.value / maxCount) * 4).ceil();
    heatmapData[entry.key] = normalized.clamp(1, 4);
  }

  return heatmapData;
});

/// Provider for conversion statistics
final conversionStatisticsProvider = FutureProvider<Map<String, int>>((
  ref,
) async {
  // Watch the stream to allow automatic updates
  final conversionsAsync = ref.watch(conversionHistoryStreamProvider);
  final conversions = conversionsAsync.value ?? [];

  final totalConversions = conversions.length;
  final totalEvents = conversions.fold<int>(
    0,
    (sum, item) => sum + item.eventCount,
  );

  return {'totalConversions': totalConversions, 'totalEvents': totalEvents};
});
