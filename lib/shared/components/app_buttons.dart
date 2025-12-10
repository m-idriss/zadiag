import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// Primary gradient button for main actions (Sign In, Register, Convert, etc.)
class PrimaryButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback onPressed;
  final bool isFullWidth;
  final bool isLarge;

  const PrimaryButton({
    super.key,
    required this.label,
    this.icon,
    required this.onPressed,
    this.isFullWidth = false,
    this.isLarge = true,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return SizedBox(
      width: isFullWidth ? double.infinity : null,
      height: isLarge ? 56 : null,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          gradient: LinearGradient(
            colors: [colorScheme.primary, colorScheme.secondary],
          ),
          boxShadow: [
            BoxShadow(
              color: colorScheme.primary.withValues(alpha: 0.3),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(AppTheme.radiusLg),
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: isLarge ? AppTheme.spacingLg : AppTheme.spacingMd,
                vertical: isLarge ? AppTheme.spacingMd : AppTheme.spacingSm,
              ),
              child: Row(
                mainAxisSize: isFullWidth ? MainAxisSize.max : MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, color: Colors.white, size: isLarge ? 22 : 18),
                    SizedBox(width: isLarge ? AppTheme.spacingSm : 8),
                  ],
                  Flexible(
                    child: Text(
                      label,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: isLarge ? 17 : 16,
                        fontWeight: FontWeight.w700,
                        fontFamily: AppTheme.defaultFontFamilyName,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Secondary button with colored background for secondary actions
class SecondaryButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback onPressed;
  final Color? color;
  final bool isFullWidth;

  const SecondaryButton({
    super.key,
    required this.label,
    this.icon,
    required this.onPressed,
    this.color,
    this.isFullWidth = false,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final buttonColor = color ?? colorScheme.secondary;

    return SizedBox(
      width: isFullWidth ? double.infinity : null,
      child: Container(
        decoration: BoxDecoration(
          color: buttonColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
                vertical: AppTheme.spacingSm,
              ),
              child: Row(
                mainAxisSize: isFullWidth ? MainAxisSize.max : MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, color: buttonColor, size: 18),
                    const SizedBox(width: AppTheme.spacingSm),
                  ],
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: buttonColor,
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
