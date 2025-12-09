import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/features/auth/screens/login_page.dart';
import 'package:zadiag/main.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/features/auth/services/user_service.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/language_manager.dart';
import 'package:zadiag/core/utils/navigation_helper.dart';
import 'package:intl/intl.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _profileFormKey = GlobalKey<FormState>();
  final _userService = UserService();
  bool _notificationsEnabled = true;
  bool _isProfileExpanded = false;

  // Profile State
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  DateTime? _birthDate;
  final _dateFormatter = DateFormat('dd/MM/yyyy');
  String _selectedLanguage = LanguageManager.defaultLanguage;
  bool _obscurePassword = true;

  static const String _notificationsKey = 'notificationsEnabled';

  @override
  void initState() {
    super.initState();
    _loadNotificationsSetting();
    _selectedLanguage = LanguageManager.getLanguageName(
      localeNotifier.value?.languageCode ?? 'en',
    );
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user != null) {
      _nameController.text = user.displayName ?? '';
      _emailController.text = user.email ?? '';
    }

    final userProfile = await _userService.getUserProfile();
    if (userProfile != null && mounted) {
      setState(() {
        if (userProfile.username != null)
          _nameController.text = userProfile.username!;
        if (userProfile.language != null)
          _selectedLanguage = userProfile.language!;
        if (userProfile.birthDate != null) _birthDate = userProfile.birthDate!;
      });
    }
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
                _profileCard(context),
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

    // Also save to Isar if possible
    await _userService.updateUserProfile(themeMode: themeModeString);
  }

  Widget _profileCard(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final colorScheme = Theme.of(context).colorScheme;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      padding: EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            colorScheme.primary.withValues(alpha: 0.1),
            colorScheme.secondary.withValues(alpha: 0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        border: Border.all(
          color: colorScheme.primary.withValues(alpha: 0.2),
          width: 1,
        ),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: () {
              setState(() {
                _isProfileExpanded = !_isProfileExpanded;
              });
            },
            behavior: HitTestBehavior.opaque,
            child: Row(
              children: [
                // Avatar
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [colorScheme.primary, colorScheme.tertiary],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: colorScheme.primary.withValues(alpha: 0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      user?.email?.substring(0, 1).toUpperCase() ?? "U",
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: AppTheme.spacingMd),
                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _nameController.text.isNotEmpty
                            ? _nameController.text
                            : (trad(context)!.profile),
                        style: TextStyle(
                          fontFamily: AppTheme.defaultFontFamilyName,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?.email ?? 'No email',
                        style: TextStyle(
                          fontFamily: AppTheme.defaultFontFamilyName,
                          fontSize: 14,
                          color: colorScheme.onSurface.withValues(alpha: 0.6),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                // Arrow
                AnimatedRotation(
                  turns: _isProfileExpanded ? 0.25 : 0,
                  duration: const Duration(milliseconds: 300),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: colorScheme.surface.withValues(alpha: 0.5),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.arrow_forward_ios_rounded,
                      color: colorScheme.primary,
                      size: 16,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Expanded Content
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Column(
              children: [
                const SizedBox(height: AppTheme.spacingLg),
                const Divider(height: 1),
                const SizedBox(height: AppTheme.spacingLg),
                Form(
                  key: _profileFormKey,
                  child: Column(
                    children: [
                      _usernameTextField(context),
                      const SizedBox(height: AppTheme.spacingMd),
                      _emailTextField(context),
                      const SizedBox(height: AppTheme.spacingMd),
                      _passwordTextField(context),
                      const SizedBox(height: AppTheme.spacingMd),
                      _birthdaySelector(context),
                      const SizedBox(height: AppTheme.spacingMd),
                      _languageSelector(context),
                      const SizedBox(height: AppTheme.spacingLg),
                      _actionButtons(context),
                      const SizedBox(height: AppTheme.spacingLg),
                      _deleteAccountCard(context),
                    ],
                  ),
                ),
              ],
            ),
            crossFadeState:
                _isProfileExpanded
                    ? CrossFadeState.showSecond
                    : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 300),
          ),
        ],
      ),
    );
  }

  Widget _usernameTextField(BuildContext context) {
    return buildTextField(
      context: context,
      controller: _nameController,
      hintText: trad(context)!.name_hint,
      iconPath: 'assets/icons/User.svg',
    );
  }

  Widget _emailTextField(BuildContext context) {
    return buildTextField(
      context: context,
      controller: _emailController,
      hintText: trad(context)!.email_hint,
      iconPath: 'assets/icons/Message.svg',
      keyboardType: TextInputType.emailAddress,
    );
  }

  Widget _passwordTextField(BuildContext context) {
    return buildTextField(
      context: context,
      controller: _passwordController,
      hintText: trad(context)!.password_hint,
      iconPath: 'assets/icons/Lock.svg',
      obscureText: _obscurePassword,
      suffixIconPath: 'assets/icons/Hide.svg',
      onSuffixTap: () {
        setState(() {
          _obscurePassword = !_obscurePassword;
        });
      },
      readOnly:
          true, // Password change might be complex inline without re-auth, keeping readonly or enabling basic
    );
  }

  GestureDetector _birthdaySelector(BuildContext context) {
    return GestureDetector(
      onTap: () => _selectBirthDate(context),
      child: AbsorbPointer(
        child: TextFormField(
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 14,
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
          decoration: inputDecoration(
            context,
            _birthDate != null
                ? _dateFormatter.format(_birthDate!)
                : trad(context)!.birthdate_hint,
            'assets/icons/Time Circle.svg',
          ),
        ),
      ),
    );
  }

  Future<void> _selectBirthDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate:
          _birthDate ??
          DateTime(
            DateTime.now().year - 30,
            DateTime.now().month,
            DateTime.now().day,
          ),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      locale: const Locale('fr', 'FR'),
      builder: (context, child) {
        return Theme(
          data: Theme.of(
            context,
          ).copyWith(colorScheme: Theme.of(context).colorScheme),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _birthDate) {
      setState(() {
        _birthDate = picked;
      });
    }
  }

  DropdownButtonFormField<String> _languageSelector(BuildContext context) {
    return DropdownButtonFormField<String>(
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurface,
        fontSize: 14,
        fontFamily: AppTheme.defaultFontFamilyName,
      ),
      icon: Icon(
        Icons.arrow_drop_down_rounded,
        color: Theme.of(context).colorScheme.primary,
      ),
      decoration: dropdownDecoration(
        context,
        trad(context)!.preferred_language,
        'assets/icons/Home.svg',
      ),
      dropdownColor: Theme.of(context).colorScheme.surface,
      initialValue: _selectedLanguage,
      items:
          LanguageManager.supportedLanguageNameLocalesMap.values
              .map((lang) => DropdownMenuItem(value: lang, child: Text(lang)))
              .toList(),
      onChanged: (val) {
        if (val != null) {
          _changeLanguage(val);
        }
      },
    );
  }

  void _changeLanguage(String language) {
    Locale newLocale = LanguageManager.getLocaleFromLanguageName(language);

    setState(() {
      _selectedLanguage = language;
    });

    MyApp.changeLanguage(context, newLocale);
  }

  Widget _actionButtons(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: buildSettingsButton(
            context,
            trad(context)!.cancel,
            Icons.close_rounded,
            () {
              setState(() {
                _isProfileExpanded = false;
                _loadUserData(); // Reset fields
              });
            },
          ),
        ),
        const SizedBox(width: AppTheme.spacingMd),
        Expanded(
          child: buildSettingsButton(
            context,
            trad(context)!.save,
            Icons.check_rounded,
            _saveProfileSettings,
          ),
        ),
      ],
    );
  }

  void _saveProfileSettings() async {
    if (_profileFormKey.currentState!.validate()) {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        // Update Isar
        await _userService.updateUserProfile(
          username: _nameController.text.trim(),
          email: _emailController.text.trim(),
          birthDate: _birthDate,
          language: _selectedLanguage,
        );

        // Update display name in Firebase Auth if needed
        await user.updateDisplayName(_nameController.text.trim());
      }
      if (!mounted) return;

      setState(() {
        _isProfileExpanded = false;
      });
    }
  }

  Widget _deleteAccountCard(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _deleteAccount,
          borderRadius: BorderRadius.circular(AppTheme.radiusXl),
          child: Padding(
            padding: EdgeInsets.all(AppTheme.spacingMd),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                  ),
                  child: Icon(
                    Icons.delete_forever_rounded,
                    color: Colors.red,
                    size: 22,
                  ),
                ),
                const SizedBox(width: AppTheme.spacingMd),
                Expanded(
                  child: Text(
                    trad(context)!.delete_account,
                    style: TextStyle(
                      fontFamily: AppTheme.defaultFontFamilyName,
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: Colors.red,
                    ),
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  color: Colors.red,
                  size: 18,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _deleteAccount() async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppTheme.radiusXl),
            ),
            title: Text(
              trad(context)!.confirm,
              style: TextStyle(
                fontFamily: AppTheme.defaultFontFamilyName,
                fontWeight: FontWeight.w600,
              ),
            ),
            content: Text(
              trad(context)!.confirm_delete_account,
              style: TextStyle(fontFamily: AppTheme.defaultFontFamilyName),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(
                  trad(context)!.cancel,
                  style: TextStyle(fontFamily: AppTheme.defaultFontFamilyName),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: Text(
                  trad(context)!.delete,
                  style: TextStyle(
                    color: Colors.red,
                    fontFamily: AppTheme.defaultFontFamilyName,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
    );

    if (confirmed != true) return;
    try {
      await _userService.deleteUserAccount();

      if (mounted) {
        NavigationHelper.navigateWithFade(context, const LoginPage());
      }
    } on FirebaseAuthException catch (e) {
      if (!mounted) return;
      showSnackBar(context, e.message ?? trad(context)!.error_occurred);
    }
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
