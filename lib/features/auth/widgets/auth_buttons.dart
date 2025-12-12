import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// A modern full-width auth button for Google sign-in.
/// 
/// Features:
/// - Dark gradient background
/// - Google multicolor icon on the left
/// - White text
/// - Rounded corners
class GoogleAuthButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final bool isLoading;

  const GoogleAuthButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF1F1F1F),
          foregroundColor: Colors.white,
          elevation: 0,
          padding: EdgeInsets.symmetric(
            horizontal: AppTheme.spacingLg,
            vertical: AppTheme.spacingMd,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusXxl),
          ),
        ),
        child: isLoading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SvgPicture.asset(
                    'assets/icons/Google.svg',
                    width: 24,
                    height: 24,
                  ),
                  const SizedBox(width: AppTheme.spacingMd),
                  Text(
                    label,
                    style: AppTheme.buttonStyleLarge(
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

/// A modern full-width auth button for Email sign-in.
/// 
/// Features:
/// - Transparent/light background with border
/// - Email icon on the left
/// - Dark gray text
/// - Same dimensions as Google button
class EmailAuthButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final bool isLoading;

  const EmailAuthButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;

    return SizedBox(
      width: double.infinity,
      height: 56,
      child: OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          backgroundColor: Colors.transparent,
          foregroundColor: isDarkMode ? Colors.white : const Color(0xFF1F1F1F),
          elevation: 0,
          padding: EdgeInsets.symmetric(
            horizontal: AppTheme.spacingLg,
            vertical: AppTheme.spacingMd,
          ),
          side: BorderSide(
            color: isDarkMode
                ? Colors.white.withValues(alpha: 0.2)
                : const Color(0xFF1F1F1F).withValues(alpha: 0.2),
            width: 1.5,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radiusXxl),
          ),
        ),
        child: isLoading
            ? SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    isDarkMode ? Colors.white : const Color(0xFF1F1F1F),
                  ),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.email_outlined,
                    size: 24,
                    color: isDarkMode ? Colors.white : const Color(0xFF1F1F1F),
                  ),
                  const SizedBox(width: AppTheme.spacingMd),
                  Text(
                    label,
                    style: AppTheme.buttonStyleLarge(
                      color: isDarkMode ? Colors.white : const Color(0xFF1F1F1F),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
