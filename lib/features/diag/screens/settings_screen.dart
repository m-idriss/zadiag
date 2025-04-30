import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/features/auth/screens/login_page.dart';
import 'package:zadiag/main.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/constants/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();

  @override
  Widget build(BuildContext context) {
    final defaultColorScheme = Theme.of(context).colorScheme;
    bool isDarkMode = themeNotifier.value == ThemeMode.dark;

    return Scaffold(
      body: Container(
        padding: const EdgeInsets.all(22),
        decoration: _background(defaultColorScheme),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              _header(context),
              const SizedBox(height: 12.0),
              _darkModeButton(context, isDarkMode),
              const SizedBox(height: 120.0),
              _deconnexionButton(context),
            ],
          ),
        ),
      ),
    );
  }

  BoxDecoration _background(ColorScheme colorScheme) {
    return buildBackground(colorScheme);
  }

  Column _header(BuildContext context) {
    return buildHeader(
      context,
      trad(context)!.settings,
      trad(context)!.settings_subtitle,
    );
  }

  Row _darkModeButton(BuildContext context, bool isDarkMode) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        Text(
          trad(context)!.dark_mode,
          style: TextStyle(
            fontFamily: AppTheme.defaultFontFamilyName,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        CupertinoSwitch(
          //activeTrackColor: Theme.of(context).colorScheme.primary,
          //thumbColor: Theme.of(context).colorScheme.tertiary,
          value: isDarkMode,
          onChanged: (value) {
            setState(() {
              themeNotifier.value = value ? ThemeMode.dark : ThemeMode.light;
            });
          },
        ),
      ],
    );
  }

  ListTile _deconnexionButton(BuildContext context) {
    return ListTile(
      leading: Icon(Icons.logout, color: Theme.of(context).colorScheme.primary),
      title: Text(
        trad(context)!.logout,
        style: TextStyle(color: Theme.of(context).colorScheme.primary),
      ),
      onTap: () {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const LoginPage()),
        );
      },
    );
  }
}
