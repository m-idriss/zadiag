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
import 'package:zadiag/shared/components/glass_scaffold.dart';
import 'package:zadiag/shared/components/glass_container.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zadiag/features/converter/providers/conversion_history_provider.dart';
import 'package:zadiag/features/converter/providers/converter_settings_provider.dart';
import 'package:zadiag/shared/components/slide_action_button.dart';
import 'package:zadiag/core/providers/text_size_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _profileFormKey = GlobalKey<FormState>();
  final _userService = UserService();
  bool _notificationsEnabled = true;
  bool _isProfileExpanded = false;
  bool _isConverterExpanded = false;

  // Profile State
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  DateTime? _birthDate;
  final _dateFormatter = DateFormat('dd/MM/yyyy');
  String _selectedLanguage = LanguageManager.defaultLanguage;
  bool _obscurePassword = true;

  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  static const String _notificationsKey = 'notificationsEnabled';

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
      ),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.2, 0.8, curve: Curves.easeOutCubic),
      ),
    );
    _animationController.forward();

    _loadNotificationsSetting();
    _selectedLanguage = LanguageManager.getLanguageName(
      localeNotifier.value?.languageCode ?? 'en',
    );
    _loadUserData();
  }

  @override
  void dispose() {
    _animationController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
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
        if (userProfile.username != null) {
          _nameController.text = userProfile.username!;
        }
        if (userProfile.language != null) {
          _selectedLanguage = userProfile.language!;
        }
        if (userProfile.birthDate != null) {
          _birthDate = userProfile.birthDate!;
        }
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
    return GlassScaffold(
      body: SafeArea(
        bottom: false,
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: SlideTransition(
            position: _slideAnimation,
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
                  _converterSettingsCard(context),
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

    return GlassContainer(
      padding: EdgeInsets.all(AppTheme.spacingMd),
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
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
                  decoration: AppTheme.avatarDecoration(colorScheme),
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
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
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
                    decoration: AppTheme.iconContainerDecoration(
                      colorScheme,
                      borderRadius: AppTheme.radiusFull,
                      color: colorScheme.surface.withValues(alpha: 0.5),
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
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurface,
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
    final colorScheme = Theme.of(context).colorScheme;
    return GlassContainer(
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
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
                  decoration: AppTheme.iconContainerDecoration(
                    colorScheme,
                    color: Colors.red.withValues(alpha: 0.1),
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
    final colorScheme = Theme.of(context).colorScheme;
    final currentTextSize = ref.watch(textSizeProvider);
    final textSizeNotifier = ref.read(textSizeProvider.notifier);

    return GlassContainer(
      padding: EdgeInsets.all(AppTheme.spacingMd),
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: AppTheme.iconContainerDecoration(colorScheme),
                child: Icon(
                  Icons.brightness_6_rounded,
                  color: colorScheme.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: AppTheme.spacingMd),
              Text(
                trad(context)!.appearance,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
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
          const SizedBox(height: AppTheme.spacingLg),
          // Text Size Section
          Text(
            trad(context)!.text_size,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: AppTheme.spacingMd),
          // Text Size options
          Row(
            children: [
              Expanded(
                child: _textSizeOptionCard(
                  context,
                  size: TextSize.small,
                  icon: Icons.text_fields,
                  label: trad(context)!.text_size_small,
                  isSelected: currentTextSize == TextSize.small,
                  onTap: () => textSizeNotifier.setTextSize(TextSize.small),
                ),
              ),
              const SizedBox(width: AppTheme.spacingSm),
              Expanded(
                child: _textSizeOptionCard(
                  context,
                  size: TextSize.normal,
                  icon: Icons.text_fields,
                  label: trad(context)!.text_size_normal,
                  isSelected: currentTextSize == TextSize.normal,
                  onTap: () => textSizeNotifier.setTextSize(TextSize.normal),
                ),
              ),
              const SizedBox(width: AppTheme.spacingSm),
              Expanded(
                child: _textSizeOptionCard(
                  context,
                  size: TextSize.large,
                  icon: Icons.text_fields,
                  label: trad(context)!.text_size_large,
                  isSelected: currentTextSize == TextSize.large,
                  onTap: () => textSizeNotifier.setTextSize(TextSize.large),
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
        decoration: AppTheme.themeOptionDecoration(
          colorScheme,
          isSelected: isSelected,
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

  Widget _textSizeOptionCard(
    BuildContext context, {
    required TextSize size,
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    final iconSize = size == TextSize.small ? 20.0 : size == TextSize.normal ? 24.0 : 28.0;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        padding: EdgeInsets.symmetric(
          vertical: AppTheme.spacingMd,
          horizontal: AppTheme.spacingSm,
        ),
        decoration: AppTheme.themeOptionDecoration(
          colorScheme,
          isSelected: isSelected,
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
              size: iconSize,
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

  Widget _converterSettingsCard(BuildContext context) {
    final settings = ref.watch(converterSettingsProvider);
    final notifier = ref.read(converterSettingsProvider.notifier);
    final colorScheme = Theme.of(context).colorScheme;

    return GlassContainer(
      padding: EdgeInsets.all(AppTheme.spacingMd),
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
      child: Column(
        children: [
          GestureDetector(
            onTap: () {
              setState(() {
                _isConverterExpanded = !_isConverterExpanded;
              });
            },
            behavior: HitTestBehavior.opaque,
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: AppTheme.iconContainerDecoration(
                    colorScheme,
                    color: colorScheme.secondary.withValues(alpha: 0.1),
                  ),
                  child: Icon(
                    Icons.settings_applications_rounded,
                    color: colorScheme.secondary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: AppTheme.spacingMd),
                Expanded(
                  child: Text(
                    'Converter', // TODO: Add translation
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface,
                    ),
                  ),
                ),
                AnimatedRotation(
                  turns: _isConverterExpanded ? 0.25 : 0,
                  duration: const Duration(milliseconds: 300),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: AppTheme.iconContainerDecoration(
                      colorScheme,
                      borderRadius: AppTheme.radiusFull,
                      color: colorScheme.surface.withValues(alpha: 0.5),
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

          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Column(
              children: [
                const SizedBox(height: AppTheme.spacingMd),
                Divider(color: colorScheme.outline.withValues(alpha: 0.2)),
                const SizedBox(height: AppTheme.spacingXs),

                _buildSwitchRow(
                  context,
                  title: 'Show Activity Dashboard', // TODO: Add translation
                  value: settings.showActivityDashboard,
                  onChanged: (val) => notifier.toggleActivityDashboard(val),
                ),

                Divider(color: colorScheme.outline.withValues(alpha: 0.2)),

                _buildSwitchRow(
                  context,
                  title: 'Save Converted Files', // TODO: Add translation
                  subtitle:
                      'Save original files to local storage', // TODO: Add translation
                  value: settings.enableStorage,
                  onChanged: (val) => notifier.toggleStorage(val),
                ),

                if (settings.enableStorage) ...[
                  Divider(color: colorScheme.outline.withValues(alpha: 0.2)),
                  const SizedBox(height: AppTheme.spacingSm),
                  Consumer(
                    builder: (context, ref, child) {
                      return SlideActionBtn(
                        text:
                            trad(context)?.clean_all_archives ??
                            'Clean all archives',
                        onConfirmation: () async {
                          await ref
                              .read(conversionHistoryServiceProvider)
                              .clearAllHistory();

                          if (context.mounted) {
                            showSnackBar(
                              context,
                              trad(context)?.archives_cleaned ??
                                  'All archives cleaned',
                            );
                          }
                        },
                        backgroundColor: Theme.of(
                          context,
                        ).colorScheme.error.withValues(alpha: 0.1),
                        sliderButtonColor: Theme.of(context).colorScheme.error,
                        sliderButtonIcon: Icons.delete_forever_rounded,
                        sliderButtonIconColor: Colors.white,
                        textStyle: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: AppTheme.spacingSm),
                ],
              ],
            ),
            crossFadeState:
                _isConverterExpanded
                    ? CrossFadeState.showSecond
                    : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 300),
          ),
        ],
      ),
    );
  }

  Widget _buildSwitchRow(
    BuildContext context, {
    required String title,
    String? subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontFamily: AppTheme.defaultFontFamilyName,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontFamily: AppTheme.defaultFontFamilyName,
                      fontSize: 12,
                      color: Theme.of(
                        context,
                      ).colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              ],
            ),
          ),
          CupertinoSwitch(
            activeTrackColor: Theme.of(context).colorScheme.primary,
            value: value,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _logoutCard(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return GlassContainer(
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
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
                  decoration: AppTheme.iconContainerDecoration(
                    colorScheme,
                    color: colorScheme.error.withValues(alpha: 0.1),
                  ),
                  child: Icon(
                    Icons.logout_rounded,
                    color: colorScheme.error,
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

  Widget _header(BuildContext context) {
    return Column(
      children: [
        // const SizedBox(height: AppTheme.spacingMd),
        Text(
          trad(context)!.settings,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onInverseSurface,
            fontWeight: FontWeight.bold,
            fontFamily: AppTheme.defaultFontFamilyName,
            fontSize: 32,
            shadows: [
              Shadow(
                color: Colors.black.withValues(alpha: 0.2),
                offset: const Offset(0, 2),
                blurRadius: 4,
              ),
            ],
          ),
          textAlign: TextAlign.center,
        ),
        /*
        const SizedBox(height: AppTheme.spacingSm),
        Text(
          trad(context)!.settings_subtitle,
          style: TextStyle(
            color: Theme.of(
              context,
            ).colorScheme.onInverseSurface.withValues(alpha: 0.9),
            fontSize: 16,
            height: 1.5,
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
          textAlign: TextAlign.center,
        ),

         */
      ],
    );
  }

  Widget _notificationCard(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    
    return GlassContainer(
      padding: EdgeInsets.all(AppTheme.spacingMd),
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: AppTheme.iconContainerDecoration(
              colorScheme,
              useGradient: true,
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
