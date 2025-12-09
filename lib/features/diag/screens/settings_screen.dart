import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';

import 'package:shared_preferences/shared_preferences.dart';
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
  bool _notificationsEnabled = true;

  static const String _notificationsKey = 'notificationsEnabled';

  @override
  void initState() {
    super.initState();
    _loadNotificationsSetting();
  }

  Future<void> _loadNotificationsSetting() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _notificationsEnabled = prefs.getBool(_notificationsKey) ?? true;
    });
  }

  Future<void> _saveNotificationsSetting(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_notificationsKey, value);
    setState(() {
      _notificationsEnabled = value;
    });
  }

  @override
  Widget build(BuildContext context) {
    final defaultColorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: _background(defaultColorScheme),
        child: SafeArea(
          bottom: false,
          child: Form(
            key: _formKey,
            child: ListView(
              padding: EdgeInsets.all(AppTheme.spacingLg),
              physics: const BouncingScrollPhysics(),
              children: [
                _header(context),
                const SizedBox(height: AppTheme.spacingMd),
                _settingsCard(context),
                const SizedBox(height: AppTheme.spacingMd),
                _notificationCard(context),
                const SizedBox(height: AppTheme.spacingMd),

                _logoutCard(context),
                const SizedBox(height: 2 * AppTheme.spacingXxl),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _saveThemePreference(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    String themeModeString;
    switch (mode) {
      case ThemeMode.light:
        themeModeString = 'light';
        break;
      case ThemeMode.dark:
        themeModeString = 'dark';
        break;
      case ThemeMode.system:
        themeModeString = 'system';
        break;
    }
    await prefs.setString('themeMode', themeModeString);
    setState(() {
      themeNotifier.value = mode;
    });
  }

  Widget _settingsCard(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Theme.of(
                    context,
                  ).colorScheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                ),
                child: Icon(
                  Icons.brightness_6_rounded,
                  color: Theme.of(context).colorScheme.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: AppTheme.spacingMd),
              Text(
                trad(context)!.appearance,
                style: TextStyle(
                  fontFamily: AppTheme.defaultFontFamilyName,
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppTheme.spacingMd),
          // Theme options
          Row(
            children: [
              Expanded(
                child: _themeOptionCard(
                  context,
                  mode: ThemeMode.light,
                  icon: Icons.wb_sunny_rounded,
                  label: trad(context)!.theme_light,
                ),
              ),
              const SizedBox(width: AppTheme.spacingSm),
              Expanded(
                child: _themeOptionCard(
                  context,
                  mode: ThemeMode.dark,
                  icon: Icons.nightlight_round,
                  label: trad(context)!.theme_dark,
                ),
              ),
              const SizedBox(width: AppTheme.spacingSm),
              Expanded(
                child: _themeOptionCard(
                  context,
                  mode: ThemeMode.system,
                  icon: Icons.brightness_auto_rounded,
                  label: trad(context)!.theme_auto,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _themeOptionCard(
    BuildContext context, {
    required ThemeMode mode,
    required IconData icon,
    required String label,
  }) {
    final isSelected = themeNotifier.value == mode;
    final colorScheme = Theme.of(context).colorScheme;

    return GestureDetector(
      onTap: () => _saveThemePreference(mode),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        padding: EdgeInsets.symmetric(
          vertical: AppTheme.spacingMd,
          horizontal: AppTheme.spacingSm,
        ),
        decoration: BoxDecoration(
          gradient:
              isSelected
                  ? LinearGradient(
                    colors: [colorScheme.primary, colorScheme.secondary],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                  : null,
          color: isSelected ? null : colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          border: Border.all(
            color:
                isSelected
                    ? colorScheme.primary.withValues(alpha: 0.3)
                    : Colors.transparent,
            width: 2,
          ),
          boxShadow:
              isSelected
                  ? [
                    BoxShadow(
                      color: colorScheme.primary.withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                  : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color:
                  isSelected
                      ? Colors.white
                      : colorScheme.onSurface.withValues(alpha: 0.7),
              size: 28,
            ),
            const SizedBox(height: AppTheme.spacingXs),
            Text(
              label,
              style: TextStyle(
                fontFamily: AppTheme.defaultFontFamilyName,
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color:
                    isSelected
                        ? Colors.white
                        : colorScheme.onSurface.withValues(alpha: 0.8),
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
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
                pageBuilder:
                    (context, animation, secondaryAnimation) =>
                        const LoginPage(),
                transitionsBuilder: (
                  context,
                  animation,
                  secondaryAnimation,
                  child,
                ) {
                  return FadeTransition(opacity: animation, child: child);
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
                    color: Theme.of(
                      context,
                    ).colorScheme.error.withValues(alpha: 0.1),
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

  Widget _notificationCard(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary,
                  Theme.of(context).colorScheme.secondary,
                ],
              ),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            ),
            child: Icon(
              Icons.notifications_rounded,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: AppTheme.spacingMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  trad(context)!.notifications,
                  style: TextStyle(
                    fontFamily: AppTheme.defaultFontFamilyName,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _notificationsEnabled
                      ? trad(context)!.enabled
                      : trad(context)!.disabled,
                  style: TextStyle(
                    fontFamily: AppTheme.defaultFontFamilyName,
                    fontSize: 12,
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
              ],
            ),
          ),
          CupertinoSwitch(
            activeTrackColor: Theme.of(context).colorScheme.primary,
            value: _notificationsEnabled,
            onChanged: _saveNotificationsSetting,
          ),
        ],
      ),
    );
  }
}
