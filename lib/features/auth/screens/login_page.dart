import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:zadiag/features/diag/diag_page.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/features/auth/screens/register_page.dart';
import 'package:zadiag/features/auth/screens/components/auth_elements.dart';

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

class _LoginPageState extends State<LoginPage> {
  @override
  Widget build(BuildContext context) {
    final defaultColorScheme = Theme.of(context).colorScheme;
    return Scaffold(
      extendBody: true,
      body: Container(
        padding: const EdgeInsets.all(22),
        decoration: _background(defaultColorScheme),
        child: ListView(
          padding: EdgeInsets.symmetric(horizontal: 24),
          physics: BouncingScrollPhysics(),
          children: [
            const SizedBox(height: 150),
            _loginWelcomeText(context),
            _loginSubtitle(context),
            _emailTextField(context),
            const SizedBox(height: 12),
            _passwordTextField(context),
            _forgoPasswordText(context),
            _signInButton(),
            _orConnectWithText(context),
            socialButtons(context),
          ],
        ),
      ),
      bottomNavigationBar: _bottom(context),
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

  _signInButton() {
    return signButton(
      context,
      Icons.login,
      trad(context)!.login_button,
      null,
      _login, // sans passer `context`
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
        MaterialPageRoute(builder: (_) => const HomePage()),
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
      child: TextButton(
        onPressed: () {},
        style: TextButton.styleFrom(
          foregroundColor: Theme.of(context).colorScheme.onPrimaryContainer,
        ),
        child: Text(
          trad(context)!.forgot_password,
          style: TextStyle(
            fontSize: 12,
            color: Theme.of(context).colorScheme.onPrimaryContainer,
            fontWeight: FontWeight.w700,
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
