import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/features/auth/screens/login_page.dart';
import 'package:zadiag/features/auth/screens/components/auth_elements.dart';
import 'package:zadiag/core/constants/app_theme.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  
  final _registerEmailController = TextEditingController();
  final _registerPasswordController = TextEditingController();
  final _registerConfirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: Curves.easeOut,
      ),
    );
    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
    _registerConfirmPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Scaffold(
      extendBody: true,
      body: Container(
        decoration: buildBackground(colorScheme),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: ListView(
              padding: EdgeInsets.symmetric(horizontal: AppTheme.spacingLg),
              physics: const BouncingScrollPhysics(),
              children: [
                const SizedBox(height: AppTheme.spacingXl),
                _brandingSection(context),
                //const SizedBox(height: AppTheme.spacingLg),
                _registerTitle(context),
                _registerSubtitle(context),
                _formCard(context),
                _orConnectWithText(context),
                _socialButtons(context),
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: _bottom(context),
    );
  }

  Widget _brandingSection(BuildContext context) {
    return Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.secondary,
            Theme.of(context).colorScheme.primary,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.secondary.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: const Center(
        child: Icon(
          Icons.person_add_rounded,
          size: 36,
          color: Colors.white,
        ),
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
          _emailTextField(context),
          const SizedBox(height: AppTheme.spacingMd),
          _passwordTextField(context),
          const SizedBox(height: AppTheme.spacingMd),
          _confirmPasswordTextField(context),
          const SizedBox(height: AppTheme.spacingLg),
          _signUpButton(context),
        ],
      ),
    );
  }

  Container _registerTitle(BuildContext context) {
    return title(context, trad(context)!.create_account);
  }

  Container _registerSubtitle(BuildContext context) {
    return subtitle(context, trad(context)!.register_subtitle);
  }

  Widget _emailTextField(BuildContext context) {
    return buildTextField(
      context: context,
      controller: _registerEmailController,
      hintText: 'jean.dupont@email.com',
      iconPath: 'assets/icons/Message.svg',
      keyboardType: TextInputType.emailAddress,
    );
  }

  Widget _passwordTextField(BuildContext context) {
    return buildTextField(
      context: context,
      controller: _registerPasswordController,
      hintText: '********',
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

  Widget _confirmPasswordTextField(BuildContext context) {
    return buildTextField(
      context: context,
      controller: _registerConfirmPasswordController,
      hintText: '********',
      iconPath: 'assets/icons/Lock.svg',
      obscureText: _obscureConfirmPassword,
      suffixIconPath: 'assets/icons/Hide.svg',
      onSuffixTap: () {
        setState(() {
          _obscureConfirmPassword = !_obscureConfirmPassword;
        });
      },
    );
  }

  Widget _signUpButton(BuildContext context) {
    return signButton(
      context,
      Icons.person_add,
      trad(context)!.sign_up,
      LoginPage(),
      () => _register(context),
    );
  }

  void _register(BuildContext context) async {
    final email = _registerEmailController.text.trim();
    final password = _registerPasswordController.text;
    final confirm = _registerConfirmPasswordController.text;

    if (password != confirm) {
      showSnackbar("Les mots de passe ne correspondent pas");
      return;
    }

    try {
      await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      showSnackbar("Compte créé avec succès !",isError: true);
      if (!context.mounted) return;
      Navigator.pushReplacement(
        context,
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) => LoginPage(),
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
    } on FirebaseAuthException catch (e) {
      String message;
      debugPrint(
        "FirebaseAuthException: ${e.code} | ${e.message} | ${e.stackTrace}",
      );
      switch (e.code) {
        case 'email-already-in-use':
          message = "Cet e-mail est déjà utilisé.";
          break;
        case 'invalid-email':
          message = "Adresse e-mail invalide.";
          break;
        case 'weak-password':
          message = "Mot de passe trop faible.";
          break;
        default:
          message = "Erreur : ${e.message}";
      }
      showSnackbar(message);
    }
  }

  void showSnackbar(String message, {bool isError = true}) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: isError ? Colors.red : Colors.green));
  }

  Widget _orConnectWithText(BuildContext context) {
    return orConnectWithText(context, trad(context)!.or_connect_with);
  }

  Widget _socialButtons(BuildContext context) {
    return socialButtons(context);
  }

  Widget _bottom(BuildContext context) {
    return bottom(context, LoginPage(), trad(context)!.already_have_account);
  }
}
