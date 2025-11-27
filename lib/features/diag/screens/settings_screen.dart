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
        decoration: _background(defaultColorScheme),
        child: SafeArea(
          child: Form(
            key: _formKey,
            child: ListView(
              padding: EdgeInsets.all(AppTheme.spacingLg),
              physics: const BouncingScrollPhysics(),
              children: [
                _header(context),
                const SizedBox(height: AppTheme.spacingXl),
                _settingsCard(context, isDarkMode),
                const SizedBox(height: AppTheme.spacingLg),
                _logoutCard(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _settingsCard(BuildContext context, bool isDarkMode) {
    return Container(
      padding: EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          _settingsItem(
            context,
            icon: Icons.dark_mode_rounded,
            title: trad(context)!.dark_mode,
            trailing: CupertinoSwitch(
              activeTrackColor: Theme.of(context).colorScheme.primary,
              value: isDarkMode,
              onChanged: (value) {
                setState(() {
                  themeNotifier.value = value ? ThemeMode.dark : ThemeMode.light;
                });
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _settingsItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required Widget trailing,
  }) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: AppTheme.spacingSm),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            ),
            child: Icon(
              icon,
              color: Theme.of(context).colorScheme.primary,
              size: 22,
            ),
          ),
          const SizedBox(width: AppTheme.spacingMd),
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                fontFamily: AppTheme.defaultFontFamilyName,
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Theme.of(context).colorScheme.onSurface,
              ),
            ),
          ),
          trailing,
        ],
      ),
    );
  }

  Widget _logoutCard(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.pushReplacement(
              context,
              PageRouteBuilder(
                pageBuilder: (context, animation, secondaryAnimation) =>
                    const LoginPage(),
                transitionsBuilder:
                    (context, animation, secondaryAnimation, child) {
                  return FadeTransition(
                    opacity: animation,
                    child: child,
                  );
                },
                transitionDuration: const Duration(milliseconds: 300),
              ),
            );
          },
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          child: Padding(
            padding: EdgeInsets.all(AppTheme.spacingMd),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.error.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  ),
                  child: Icon(
                    Icons.logout_rounded,
                    color: Theme.of(context).colorScheme.error,
                    size: 22,
                  ),
                ),
                const SizedBox(width: AppTheme.spacingMd),
                Expanded(
                  child: Text(
                    trad(context)!.logout,
                    style: TextStyle(
                      fontFamily: AppTheme.defaultFontFamilyName,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  color: Theme.of(context).colorScheme.error,
                  size: 18,
                ),
              ],
            ),
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
}
