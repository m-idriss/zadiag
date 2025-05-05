import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/auth/screens/splash_page.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:zadiag/firebase_options.dart';
import 'package:zadiag/l10n/app_localizations.dart';

final ValueNotifier<ThemeMode> themeNotifier = ValueNotifier(ThemeMode.system);
final ValueNotifier<Locale?> localeNotifier = ValueNotifier(null);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await _loadSavedLocale();
  runApp(const MyApp());
}

Future<void> _loadSavedLocale() async {
  final prefs = await SharedPreferences.getInstance();
  final code = prefs.getString('languageCode');
  if (code != null) {
    localeNotifier.value = Locale(code);
  }
}

Future<void> setLocale(BuildContext context, Locale newLocale) async {
  localeNotifier.value = newLocale;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('languageCode', newLocale.languageCode);
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  static Future<void> changeLanguage(BuildContext context, Locale newLocale) =>
      setLocale(context, newLocale);

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeNotifier,
      builder: (context, currentTheme, _) {
        return ValueListenableBuilder<Locale?>(
          valueListenable: localeNotifier,
          builder: (context, currentLocale, _) {
            return MaterialApp(
              debugShowCheckedModeBanner: false,
              title: 'Zadiag',
              locale: currentLocale,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              theme: ThemeData(
                useMaterial3: true,
                colorScheme: lightColorScheme,
              ),
              darkTheme: ThemeData(
                useMaterial3: true,
                colorScheme: darkColorScheme,
              ),
              themeMode: currentTheme,
              home: const SplashPage(),
            );
          },
        );
      },
    );
  }
}
