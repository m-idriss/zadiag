import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/utils/navigation_helper.dart';
import 'package:zadiag/features/auth/screens/login_page.dart';
import 'package:zadiag/features/auth/screens/components/auth_elements.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/shared/components/glass_scaffold.dart';
import 'package:zadiag/shared/components/glass_container.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  final _registerEmailController = TextEditingController();
  final _registerPasswordController = TextEditingController();
  final _registerConfirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOut),
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
    return GlassScaffold(
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: SlideTransition(
            position: _slideAnimation,
            child: ListView(
              padding: EdgeInsets.symmetric(horizontal: AppTheme.spacingLg),
              physics: const BouncingScrollPhysics(),
              children: [
                const SizedBox(height: AppTheme.spacingXl),
                Center(
                  child: Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(30),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.2),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Container(
                      width: 60,
                      height: 60,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Icon(
                          Icons.person_add_rounded,
                          size: 32,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppTheme.spacingXs),
                _registerTitle(context),
                _registerSubtitle(context),
                _formCard(context),
                _orConnectWithText(context),
                _socialButtons(context),
                const SizedBox(height: 80), // Space for bottom bar
              ],
            ),
          ),
        ),
      ),
      bottomNavigationBar: _bottom(context),
    );
  }

  Widget _formCard(BuildContext context) {
    return GlassContainer(
      padding: EdgeInsets.all(AppTheme.spacingLg),
      borderRadius: AppTheme.radiusXl,
      opacity: 0.9,
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
    return Container(
      margin: EdgeInsets.only(bottom: AppTheme.spacingSm),
      child: Text(
        trad(context)!.create_account,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Colors.white,
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
      ),
    );
  }

  Container _registerSubtitle(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(bottom: AppTheme.spacingMd),
      child: Text(
        trad(context)!.register_subtitle,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.9),
          fontSize: 16,
          height: 1.5,
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
      ),
    );
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
      const LoginPage(),
      () => _register(context),
    );
  }

  void _register(BuildContext context) async {
    final email = _registerEmailController.text.trim();
    final password = _registerPasswordController.text;
    final confirm = _registerConfirmPasswordController.text;

    if (password != confirm) {
      showSnackbar(trad(context)?.passwords_do_not_match ?? "Passwords do not match");
      return;
    }

    try {
      await FirebaseAuth.instance.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      showSnackbar(trad(context)?.account_created ?? "Account created successfully!", isError: false);
      if (!context.mounted) return;
      NavigationHelper.navigateWithFade(context, const LoginPage());
    } on FirebaseAuthException catch (e) {
      String message;
      debugPrint(
        "FirebaseAuthException: ${e.code} | ${e.message} | ${e.stackTrace}",
      );
      switch (e.code) {
        case 'email-already-in-use':
          message = trad(context)?.email_already_in_use ?? "This email is already in use.";
          break;
        case 'invalid-email':
          message = trad(context)?.invalid_email ?? "Invalid email address.";
          break;
        case 'weak-password':
          message = trad(context)?.weak_password ?? "Password is too weak.";
          break;
        default:
          message = "${trad(context)?.error ?? 'Error'}: ${e.message}";
      }
      showSnackbar(message);
    }
  }

  void showSnackbar(String message, {bool isError = true}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
      ),
    );
  }

  Widget _orConnectWithText(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(
        top: AppTheme.spacingMd,
        bottom: AppTheme.spacingMd,
      ),
      child: Row(
        children: [
          Expanded(
            child: Divider(
              color: Colors.white.withValues(alpha: 0.3),
              thickness: 1,
            ),
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
            child: Text(
              trad(context)!.or_connect_with,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.8),
                fontSize: 12,
                fontFamily: AppTheme.defaultFontFamilyName,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(
            child: Divider(
              color: Colors.white.withValues(alpha: 0.3),
              thickness: 1,
            ),
          ),
        ],
      ),
    );
  }

  Widget _socialButtons(BuildContext context) {
    return socialButtons(context);
  }

  Widget _bottom(BuildContext context) {
    return Container(
      height: 60,
      alignment: Alignment.center,
      child: TextButton(
        onPressed: () {
          NavigationHelper.navigateWithFadePostFrame(
            context,
            const LoginPage(),
          );
        },
        style: TextButton.styleFrom(
          padding: EdgeInsets.symmetric(
            horizontal: AppTheme.spacingMd,
            vertical: AppTheme.spacingSm,
          ),
        ),
        child: Text(
          trad(context)!.already_have_account,
          style: TextStyle(
            color: Theme.of(context).colorScheme.primary,
            fontFamily: AppTheme.defaultFontFamilyName,
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}
