import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:zadiag/features/diag/diag_page.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/features/auth/screens/register_page.dart';
import 'package:zadiag/features/auth/screens/components/auth_elements.dart';
import 'package:zadiag/core/constants/app_theme.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<StatefulWidget> createState() => _LoginPageState();
}

final _loginEmailController = TextEditingController(
  text: 'jean.dupont@email.com',
);
final _loginPasswordController = TextEditingController();
bool _obscurePassword = true;

class _LoginPageState extends State<LoginPage>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final defaultColorScheme = Theme.of(context).colorScheme;
    return Scaffold(
      extendBody: true,
      body: Container(
        decoration: _background(defaultColorScheme),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: ListView(
              padding: EdgeInsets.symmetric(horizontal: AppTheme.spacingLg),
              physics: const BouncingScrollPhysics(),
              children: [
                const SizedBox(height: AppTheme.spacingXxl),
                _brandingSection(context),
                const SizedBox(height: AppTheme.spacingXl),
                _loginWelcomeText(context),
                _loginSubtitle(context),
                _formCard(context),
                _orConnectWithText(context),
                socialButtons(context),
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
            Theme.of(context).colorScheme.primary,
            Theme.of(context).colorScheme.secondary,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Center(
        child: Text(
          'Z',
          style: TextStyle(
            fontSize: 40,
            fontWeight: FontWeight.bold,
            color: Colors.white,
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
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
          _forgoPasswordText(context),
          const SizedBox(height: AppTheme.spacingSm),
          _signInButton(),
        ],
      ),
    );
  }

  BoxDecoration _background(ColorScheme colorScheme) {
    return buildBackground(colorScheme);
  }

  Container _loginWelcomeText(BuildContext context) {
    return title(context, trad(context)!.welcome);
  }

  Container _loginSubtitle(BuildContext context) {
    return subtitle(context, trad(context)!.login_subtitle);
  }

  Widget _signInButton() {
    return signButton(
      context,
      Icons.login,
      trad(context)!.login_button,
      null,
      _login,
    );
  }

  void _login() async {
    final email = _loginEmailController.text.trim();
    final password = _loginPasswordController.text;

    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: email,
        password: password,
      );
      if (!mounted) return;

      Navigator.pushReplacement(
        context,
        PageRouteBuilder(
          pageBuilder: (context, animation, secondaryAnimation) =>
              const HomePage(),
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
      String message = 'Erreur inconnue';
      if (e.code == 'user-not-found') {
        message = 'Utilisateur non trouvé';
      } else if (e.code == 'wrong-password') {
        message = 'Mot de passe incorrect';
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  Widget _emailTextField(BuildContext context) {
    return buildTextField(
      context: context,
      controller: _loginEmailController,
      hintText: 'jean.dupont@email.com',
      iconPath: 'assets/icons/Message.svg',
      keyboardType: TextInputType.emailAddress,
    );
  }

  Widget _passwordTextField(BuildContext context) {
    return buildTextField(
      context: context,
      controller: _loginPasswordController,
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

  Widget _forgoPasswordText(BuildContext context) {
    return Container(
      alignment: Alignment.centerRight,
      margin: EdgeInsets.only(top: AppTheme.spacingSm),
      child: TextButton(
        onPressed: () {},
        style: TextButton.styleFrom(
          foregroundColor: Theme.of(context).colorScheme.primary,
          padding: EdgeInsets.symmetric(
            horizontal: AppTheme.spacingSm,
            vertical: AppTheme.spacingXs,
          ),
        ),
        child: Text(
          trad(context)!.forgot_password,
          style: TextStyle(
            fontSize: 13,
            color: Theme.of(context).colorScheme.primary,
            fontWeight: FontWeight.w600,
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
        ),
      ),
    );
  }

  Widget _orConnectWithText(BuildContext context) {
    return orConnectWithText(context, trad(context)!.or_connect_with);
  }

  Widget _bottom(BuildContext context) {
    return bottom(context, RegisterPage(), trad(context)!.no_account_yet);
  }
}
