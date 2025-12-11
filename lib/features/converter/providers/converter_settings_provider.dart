import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ConverterSettingsState {
  final bool showActivityDashboard;
  final bool enableStorage;

  const ConverterSettingsState({
    this.showActivityDashboard = true,
    this.enableStorage = true,
  });

  ConverterSettingsState copyWith({
    bool? showActivityDashboard,
    bool? enableStorage,
  }) {
    return ConverterSettingsState(
      showActivityDashboard:
          showActivityDashboard ?? this.showActivityDashboard,
      enableStorage: enableStorage ?? this.enableStorage,
    );
  }
}

class ConverterSettingsNotifier extends StateNotifier<ConverterSettingsState> {
  static const String _showDashboardKey = 'converter_show_dashboard';
  static const String _enableStorageKey = 'converter_enable_storage';

  ConverterSettingsNotifier() : super(const ConverterSettingsState()) {
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final showDashboard = prefs.getBool(_showDashboardKey) ?? true;
    final enableStorage = prefs.getBool(_enableStorageKey) ?? true;

    state = ConverterSettingsState(
      showActivityDashboard: showDashboard,
      enableStorage: enableStorage,
    );
  }

  Future<void> toggleActivityDashboard(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_showDashboardKey, value);
    state = state.copyWith(showActivityDashboard: value);
  }

  Future<void> toggleStorage(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enableStorageKey, value);
    state = state.copyWith(enableStorage: value);
  }
}

final converterSettingsProvider =
    StateNotifierProvider<ConverterSettingsNotifier, ConverterSettingsState>((
      ref,
    ) {
      return ConverterSettingsNotifier();
    });
