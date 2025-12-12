import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/utils/navigation_helper.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/services/log_service.dart';
import 'package:zadiag/features/auth/widgets/auth_buttons.dart';
import 'package:zadiag/features/auth/services/google_sign_in_service.dart';
import 'package:zadiag/features/auth/screens/login_page.dart';
import 'package:zadiag/features/diag/diag_page.dart';
import 'package:zadiag/shared/components/glass_scaffold.dart';
import 'package:zadiag/shared/components/zadiag_logo.dart';

/// Modern login screen with Google and Email authentication options.
/// 
/// Features:
/// - Clean, modern design matching the reference image
/// - "Continue with Google" button (dark background)
/// - "Continue with Email" button (light/transparent background)
/// - Proper loading and error handling
/// - Navigation to email login screen
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  final GoogleSignInService _googleSignInService = GoogleSignInService();
  bool _isGoogleLoading = false;
  bool _isEmailLoading = false;

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
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: AppTheme.spacingLg),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Spacer(),
                  const ZadiagLogo(size: 100),
                  const SizedBox(height: AppTheme.spacingXl),
                  _buildWelcomeText(context),
                  const SizedBox(height: AppTheme.spacingSm),
                  _buildSubtitle(context),
                  const SizedBox(height: AppTheme.spacingXxl),
                  _buildGoogleButton(context),
                  const SizedBox(height: AppTheme.spacingMd),
                  _buildEmailButton(context),
                  const Spacer(),
                  _buildTermsText(context),
                  const SizedBox(height: AppTheme.spacingLg),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildWelcomeText(BuildContext context) {
    return Text(
      trad(context)!.welcome_back,
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: Colors.white,
            shadows: AppTheme.textShadow,
          ),
    );
  }

  Widget _buildSubtitle(BuildContext context) {
    return Text(
      trad(context)!.choose_login_method,
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: Colors.white.withValues(alpha: 0.9),
            height: 1.5,
          ),
    );
  }

  Widget _buildGoogleButton(BuildContext context) {
    return GoogleAuthButton(
      label: trad(context)!.continue_with_google,
      isLoading: _isGoogleLoading,
      onPressed: _handleGoogleSignIn,
    );
  }

  Widget _buildEmailButton(BuildContext context) {
    return EmailAuthButton(
      label: trad(context)!.continue_with_email,
      isLoading: _isEmailLoading,
      onPressed: _handleEmailSignIn,
    );
  }

  Widget _buildTermsText(BuildContext context) {
    return Text(
      'By continuing, you agree to our Terms of Service and Privacy Policy',
      textAlign: TextAlign.center,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.white.withValues(alpha: 0.6),
            fontSize: 12,
          ),
    );
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() {
      _isGoogleLoading = true;
    });

    try {
      Log.i('LoginScreen: Starting Google sign-in');
      final user = await _googleSignInService.signInWithGoogle();

      if (user != null) {
        Log.i('LoginScreen: Google sign-in successful for ${user.email}');
        if (!mounted) return;
        
        // Navigate to home page
        NavigationHelper.navigateWithFade(context, const HomePage());
      } else {
        Log.i('LoginScreen: Google sign-in cancelled by user');
      }
    } catch (e, stack) {
      Log.e('LoginScreen: Google sign-in failed', e, stack);
      if (!mounted) return;

      showSnackBar(
        context,
        trad(context)?.error_occurred ?? 'An error occurred during sign-in',
        true,
      );
    } finally {
      if (mounted) {
        setState(() {
          _isGoogleLoading = false;
        });
      }
    }
  }

  void _handleEmailSignIn() {
    setState(() {
      _isEmailLoading = true;
    });

    Log.i('LoginScreen: Navigating to email login');
    
    // Navigate to the existing email login page
    NavigationHelper.navigateWithFadePostFrame(context, const LoginPage());

    // Reset loading state after navigation
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        setState(() {
          _isEmailLoading = false;
        });
      }
    });
  }
}
