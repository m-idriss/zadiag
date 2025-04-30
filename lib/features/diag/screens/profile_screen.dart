import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:zadiag/core/utils/language_manager.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/utils/translate.dart';
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
        padding: const EdgeInsets.all(22),
        decoration: _background(defaultColorScheme),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              _header(context),
              const SizedBox(height: 20),
              _usernameTextField(context),
              const SizedBox(height: 12),
              _emailTextField(context),
              const SizedBox(height: 12),
              _passwordTextField(context),
              const SizedBox(height: 12),
              _birthdaySelector(context),
              const SizedBox(height: 12),
              _languageSelector(context),
              const SizedBox(height: 24),
              _actionButtons(context),
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
        color: Theme.of(context).colorScheme.primary,
        fontSize: 16,
        fontFamily: AppTheme.defaultFontFamilyName,
      ),
      icon: Icon(
        Icons.arrow_drop_down,
        color: Theme.of(context).colorScheme.primary,
      ),
      decoration: dropdownDecoration(
        context,
        trad(context)!.preferred_language,
        'assets/icons/Home.svg',
      ),
      dropdownColor: Theme.of(context).colorScheme.secondary,
      value: _selectedLanguage,
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

  Row _actionButtons(BuildContext context) {
    return Row(
      children: [
        buildSettingsButton(
          context,
          trad(context)!.cancel,
          Icons.cancel,
          _cancelChanges,
        ),
        const SizedBox(width: 36),
        buildSettingsButton(
          context,
          trad(context)!.save,
          Icons.save,
          _saveSettings,
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
    showSnackBar(context, trad(context)!.changes_canceled);
  }
}
