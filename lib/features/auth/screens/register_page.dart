import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/features/auth/screens/login_page.dart';
import 'package:zadiag/features/auth/screens/components/auth_elements.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

final _registerEmailController = TextEditingController();
final _registerPasswordController = TextEditingController();
final _registerConfirmPasswordController = TextEditingController();
bool _obscurePassword = true;
bool _obscureConfirmPassword = true;

class _RegisterPageState extends State<RegisterPage> {
  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Scaffold(
      extendBody: true,
      body: Container(
        padding: const EdgeInsets.all(22),
        decoration: buildBackground(colorScheme),
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          physics: const BouncingScrollPhysics(),
          children: [
            const SizedBox(height: 100),
            _registerTitle(context),
            _registerSubtitle(context),
            _emailTextField(context),
            const SizedBox(height: 12),
            _passwordTextField(context),
            const SizedBox(height: 12),
            _confirmPasswordTextField(context),
            _signUpButton(context),
            _orConnectWithText(context),
            _socialButtons(context),
          ],
        ),
      ),
      bottomNavigationBar: _bottom(context),
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

  Widget signButtonRegister(
    BuildContext context,
    IconData icon,
    String text,
    Widget page,
    VoidCallback? onPressed,
  ) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 16),
      width: double.infinity,
      child: buildConnectButton(context, text, icon, () {
        if (onPressed != null) {
          onPressed();
        } else {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => page),
          );
        }
      }),
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
      showSnackbar("Compte créé avec succès !");
      if (!context.mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => LoginPage()),
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

  void showSnackbar(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
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
