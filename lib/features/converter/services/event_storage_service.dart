import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/calendar_event.dart';

/// Service for persisting calendar events using SharedPreferences.
///
/// This service allows events to persist across navigation within the app,
/// so when users leave the converter page and come back, their events remain.
class EventStorageService {
  /// Key used to store events in SharedPreferences
  static const String _eventsKey = 'converter_saved_events';

  /// Key used to store the generated ICS content
  static const String _icsKey = 'converter_saved_ics';

  /// SharedPreferences instance (injectable for testing)
  final SharedPreferences? _prefsInstance;

  /// Creates an EventStorageService instance.
  ///
  /// [prefs] - Optional SharedPreferences instance for dependency injection
  EventStorageService({SharedPreferences? prefs}) : _prefsInstance = prefs;

  /// Gets the SharedPreferences instance
  Future<SharedPreferences> _getPrefs() async {
    return _prefsInstance ?? await SharedPreferences.getInstance();
  }

  /// Saves calendar events to persistent storage.
  ///
  /// [events] - List of CalendarEvent objects to save
  /// [icsContent] - Optional ICS content string to save alongside events
  Future<bool> saveEvents(List<CalendarEvent> events, {String? icsContent}) async {
    try {
      final prefs = await _getPrefs();
      final eventsJson = events.map((e) => e.toJson()).toList();
      final success = await prefs.setString(_eventsKey, jsonEncode(eventsJson));

      if (icsContent != null) {
        await prefs.setString(_icsKey, icsContent);
      } else {
        await prefs.remove(_icsKey);
      }

      return success;
    } catch (e) {
      return false;
    }
  }

  /// Loads saved calendar events from persistent storage.
  ///
  /// Returns an empty list if no events are saved or if an error occurs.
  Future<List<CalendarEvent>> loadEvents() async {
    try {
      final prefs = await _getPrefs();
      final eventsString = prefs.getString(_eventsKey);

      if (eventsString == null || eventsString.isEmpty) {
        return [];
      }

      final eventsList = jsonDecode(eventsString) as List<dynamic>;
      return eventsList
          .map((json) => CalendarEvent.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return [];
    }
  }

  /// Loads saved ICS content from persistent storage.
  ///
  /// Returns null if no ICS content is saved.
  Future<String?> loadIcsContent() async {
    try {
      final prefs = await _getPrefs();
      return prefs.getString(_icsKey);
    } catch (e) {
      return null;
    }
  }

  /// Clears all saved events and ICS content.
  Future<bool> clearEvents() async {
    try {
      final prefs = await _getPrefs();
      await prefs.remove(_eventsKey);
      await prefs.remove(_icsKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /// Checks if there are any saved events.
  Future<bool> hasEvents() async {
    final events = await loadEvents();
    return events.isNotEmpty;
  }
}
