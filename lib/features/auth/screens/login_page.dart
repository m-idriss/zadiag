import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:zadiag/features/diag/diag_page.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/utils/navigation_helper.dart';
import 'package:zadiag/features/auth/screens/register_page.dart';
import 'package:zadiag/features/auth/screens/components/auth_elements.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/shared/components/glass_scaffold.dart';
import 'package:zadiag/shared/components/glass_container.dart';
import 'package:zadiag/shared/components/zadiag_logo.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<StatefulWidget> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  final _loginEmailController = TextEditingController(
    text: 'jean.dupont@email.com',
  );
  final _loginPasswordController = TextEditingController();
  bool _obscurePassword = true;

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
  }

  @override
  void dispose() {
    _animationController.dispose();
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
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
                const Center(child: ZadiagLogo(size: 100)),
                const SizedBox(height: AppTheme.spacingXs),
                _loginWelcomeText(context),
                _loginSubtitle(context),
                _formCard(context),
                _orConnectWithText(context),
                socialButtons(context),
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
          _forgoPasswordText(context),
          _signInButton(),
        ],
      ),
    );
  }

  Container _loginWelcomeText(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(bottom: AppTheme.spacingSm),
      child: Text(
        trad(context)!.welcome,
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

  Container _loginSubtitle(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(bottom: AppTheme.spacingMd),
      child: Text(
        trad(context)!.login_subtitle,
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

      NavigationHelper.navigateWithFade(context, const HomePage());
    } on FirebaseAuthException catch (e) {
      if (!mounted) return;
      String message = trad(context)?.unknown_error ?? 'Unknown error';
      if (e.code == 'user-not-found') {
        message = trad(context)?.user_not_found ?? 'User not found';
      } else if (e.code == 'wrong-password') {
        message = trad(context)?.wrong_password ?? 'Wrong password';
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
      margin: EdgeInsets.only(top: AppTheme.spacingXs),
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

  Widget _bottom(BuildContext context) {
    return Container(
      height: 60,
      alignment: Alignment.center,
      child: TextButton(
        onPressed: () {
          NavigationHelper.navigateWithFadePostFrame(
            context,
            const RegisterPage(),
          );
        },
        style: TextButton.styleFrom(
          padding: EdgeInsets.symmetric(
            horizontal: AppTheme.spacingMd,
            vertical: AppTheme.spacingSm,
          ),
        ),
        child: Text(
          trad(context)!.no_account_yet,
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
