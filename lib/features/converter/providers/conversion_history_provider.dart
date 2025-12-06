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
  final service = ref.watch(conversionHistoryServiceProvider);

  // Get data for the last 365 days
  final endDate = DateTime.now();
  final startDate = endDate.subtract(const Duration(days: 365));

  final counts = await service.getConversionCountsForRange(
    startDate: startDate,
    endDate: endDate,
  );

  // Normalize counts to 0-4 scale for heatmap
  if (counts.isEmpty) {
    return {};
  }

  final maxCount = counts.values.reduce((a, b) => a > b ? a : b);
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
  final service = ref.watch(conversionHistoryServiceProvider);
  return service.getStatistics();
});
