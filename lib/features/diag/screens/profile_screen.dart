import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:zadiag/core/utils/language_manager.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/features/auth/screens/login_page.dart';
import 'package:zadiag/main.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  DateTime? _birthDate;
  final _dateFormatter = DateFormat('dd/MM/yyyy');
  String _selectedLanguage = LanguageManager.defaultLanguage;
  bool _obscurePassword = true;

  // Firebase instances
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  @override
  void initState() {
    super.initState();
    _selectedLanguage = LanguageManager.getLanguageName(
      localeNotifier.value?.languageCode ?? 'en',
    );
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    User? user = _auth.currentUser;
    if (user != null) {
      _nameController.text = user.displayName ?? '';
      _emailController.text = user.email ?? '';
    }
    DocumentSnapshot userDoc =
        await _firestore.collection('users').doc(user?.uid).get();
    if (userDoc.exists) {
      setState(() {
        _nameController.text =
            (userDoc.data() as Map<String, dynamic>)['username'] ?? '';
        _selectedLanguage =
            (userDoc.data() as Map<String, dynamic>)['language'] ??
            LanguageManager.defaultLanguage;
        _birthDate =
            (userDoc.data() as Map<String, dynamic>)['birthDate']?.toDate();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final defaultColorScheme = Theme.of(context).colorScheme;
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
                const SizedBox(height: AppTheme.spacingLg),
                _avatarSection(context),
                const SizedBox(height: AppTheme.spacingLg),
                _formCard(context),
                const SizedBox(height: AppTheme.spacingLg),
                _actionButtons(context),
                const SizedBox(height: AppTheme.spacingMd),
                _deleteAccountCard(context),
                const SizedBox(height: 2 * AppTheme.spacingXxl),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _avatarSection(BuildContext context) {
    return Center(
      child: Stack(
        children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary,
                  Theme.of(context).colorScheme.secondary,
                ],
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: const Center(
              child: Icon(
                Icons.person_rounded,
                size: 48,
                color: Colors.white,
              ),
            ),
          ),
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                shape: BoxShape.circle,
                border: Border.all(
                  color: Theme.of(context).colorScheme.outline,
                  width: 2,
                ),
              ),
              child: Icon(
                Icons.camera_alt_rounded,
                size: 16,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _formCard(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(AppTheme.spacingLg),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: AppTheme.cardShadow,
      ),
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
        ],
      ),
    );
  }

  BoxDecoration _background(ColorScheme colorScheme) {
    return buildBackground(colorScheme);
  }

  Column _header(BuildContext context) {
    return buildHeader(
      context,
      trad(context)!.profile,
      trad(context)!.manage_profil,
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
          data: Theme.of(context).copyWith(
            colorScheme: Theme.of(context).colorScheme,
          ),
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
            _cancelChanges,
          ),
        ),
        const SizedBox(width: AppTheme.spacingMd),
        Expanded(
          child: buildSettingsButton(
            context,
            trad(context)!.save,
            Icons.check_rounded,
            _saveSettings,
          ),
        ),
      ],
    );
  }

  void _saveSettings() async {
    if (_formKey.currentState!.validate()) {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
          'username': _nameController.text.trim(),
          'email': _emailController.text.trim(),
          'birthDate': _birthDate,
          'language': _selectedLanguage,
        }, SetOptions(merge: true));
      }
      if (!mounted) return;
      showSnackBar(context, trad(context)!.changes_saved);
    }
  }

  void _cancelChanges() {
    showSnackBar(context, trad(context)!.changes_canceled, true);
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
              style: TextStyle(
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(
                  trad(context)!.cancel,
                  style: TextStyle(
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
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
      await FirebaseFirestore.instance
          .collection('users')
          .doc(user.uid)
          .delete();

      await user.delete();

      if (mounted) {
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
      }
    } on FirebaseAuthException catch (e) {
      if (!mounted) return;
      showSnackBar(context, e.message ?? trad(context)!.error_occurred);
    }
  }
}
