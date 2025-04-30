import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LanguageManager extends ChangeNotifier {
  Locale? _locale;

  Locale? get locale => _locale;

  static const String _languageCodeKey = 'languageCode';

  static String defaultLanguage = getLanguageName('en');

  LanguageManager() {
    _loadSavedLocale();
  }

  Future<void> _loadSavedLocale() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(_languageCodeKey);
    if (code != null) {
      _locale = Locale(code);
      notifyListeners();
    }
  }

  static Map<Locale, String> supportedLanguageNameLocalesMap = {
    const Locale('en', 'US'): 'English',
    const Locale('fr', 'FR'): 'Français',
  };

  static String getLanguageName(String languageCode) {
    return supportedLanguageNameLocalesMap[getLocaleFromLanguageCode(
          languageCode,
        )] ??
        supportedLanguageNameLocalesMap.values.first;
  }

  static Locale getLocaleFromLanguageCode(String languageCode) {
    return supportedLanguageNameLocalesMap.keys.firstWhere(
      (locale) => locale.languageCode == languageCode,
      orElse: () => supportedLanguageNameLocalesMap.keys.first,
    );
  }

  static Locale getLocaleFromLanguageName(String languageName) {
    return supportedLanguageNameLocalesMap.entries
        .firstWhere(
          (entry) => entry.value == languageName,
          orElse: () => supportedLanguageNameLocalesMap.entries.first,
        )
        .key;
  }

  Future<void> setLocale(Locale locale) async {
    _locale = locale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_languageCodeKey, locale.languageCode);
    notifyListeners();
  }

  Future<void> clearLocale() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_languageCodeKey);
    _locale = null;
    notifyListeners();
  }
}
