import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/services.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/services/log_service.dart';
import 'package:zadiag/core/services/isar_service.dart';
import 'package:zadiag/features/auth/screens/splash_page.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:zadiag/firebase_options.dart';
import 'package:zadiag/l10n/app_localizations.dart';
import 'package:zadiag/core/providers/text_size_provider.dart';

final ValueNotifier<ThemeMode> themeNotifier = ValueNotifier(ThemeMode.system);
final ValueNotifier<Locale?> localeNotifier = ValueNotifier(null);

void main() async {
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      await SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
      ]);

      // Log app startup
      Log.i('Starting Zadiag App...');

      FlutterError.onError = (FlutterErrorDetails details) {
        Log.e(
          'Flutter Error: ${details.exception}',
          details.exception,
          details.stack,
        );
      };

      PlatformDispatcher.instance.onError = (error, stack) {
        Log.e('Platform Error: $error', error, stack);
        return true;
      };

      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      // Initialize Isar
      await IsarService().openDB();

      await _loadSavedTheme();
      await _loadSavedLocale();

      runApp(const ProviderScope(child: MyApp()));
    },
    (error, stack) {
      Log.e('Uncaught Error: $error', error, stack);
    },
  );
}

Future<void> _loadSavedTheme() async {
  final prefs = await SharedPreferences.getInstance();
  final themeModeString = prefs.getString('themeMode');
  if (themeModeString != null) {
    switch (themeModeString) {
      case 'light':
        themeNotifier.value = ThemeMode.light;
        break;
      case 'dark':
        themeNotifier.value = ThemeMode.dark;
        break;
      case 'system':
        themeNotifier.value = ThemeMode.system;
        break;
    }
  }
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

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  static Future<void> changeLanguage(BuildContext context, Locale newLocale) =>
      setLocale(context, newLocale);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final textSize = ref.watch(textSizeProvider);
    final textScaleFactor = textSize.scaleFactor;

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
              theme: AppTheme.getLight(),
              darkTheme: AppTheme.getDark(),
              themeMode: currentTheme,
              home: const SplashPage(),
              builder: (context, child) {
                // Apply text scaling globally using MediaQuery
                return MediaQuery(
                  data: MediaQuery.of(context).copyWith(
                    textScaler: TextScaler.linear(textScaleFactor),
                  ),
                  child: child!,
                );
              },
            );
          },
        );
      },
    );
  }
}
