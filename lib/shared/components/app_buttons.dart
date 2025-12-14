import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// Primary gradient button for main actions (Sign In, Register, Convert, etc.)
class PrimaryButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool isFullWidth;
  final bool isLarge;
  final bool isLoading;

  const PrimaryButton({
    super.key,
    required this.label,
    this.icon,
    required this.onPressed,
    this.isFullWidth = false,
    this.isLarge = true,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDisabled = onPressed == null && !isLoading;

    return SizedBox(
      width: isFullWidth ? double.infinity : null,
      height: isLarge ? 48 : null,
      child: Opacity(
        opacity: isDisabled ? 0.5 : 1.0,
        child: Container(
          decoration: AppTheme.buttonDecoration(colorScheme),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: isDisabled || isLoading ? null : onPressed,
              borderRadius: BorderRadius.circular(AppTheme.radiusLg),
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: isLarge ? AppTheme.spacingLg : AppTheme.spacingMd,
                  vertical: isLarge ? 12.0 : AppTheme.spacingSm,
                ),
                child: Row(
                  mainAxisSize: isFullWidth ? MainAxisSize.max : MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (isLoading) ...[
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      ),
                      SizedBox(width: AppTheme.spacingSm),
                    ] else if (icon != null) ...[
                      Icon(icon, color: Colors.white, size: isLarge ? 22 : 18),
                      SizedBox(width: isLarge ? AppTheme.spacingSm : 8),
                    ],
                    Flexible(
                      child: Text(
                        label,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: colorScheme.onPrimary,
                          fontSize: isLarge ? 15 : 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
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
  final VoidCallback? onPressed;
  final Color? color;
  final bool isFullWidth;
  final bool isLoading;

  const SecondaryButton({
    super.key,
    required this.label,
    this.icon,
    required this.onPressed,
    this.color,
    this.isFullWidth = false,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final buttonColor = color ?? colorScheme.secondary;
    final isDisabled = onPressed == null && !isLoading;

    return SizedBox(
      width: isFullWidth ? double.infinity : null,
      height: 48,
      child: Opacity(
        opacity: isDisabled ? 0.5 : 1.0,
        child: Container(
          decoration: AppTheme.cardDecoration(
            colorScheme,
            color: buttonColor.withValues(alpha: 0.1),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: isDisabled || isLoading ? null : onPressed,
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
                    if (isLoading) ...[
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(buttonColor),
                        ),
                      ),
                      const SizedBox(width: AppTheme.spacingSm),
                    ] else if (icon != null) ...[
                      Icon(icon, color: buttonColor, size: 18),
                      const SizedBox(width: AppTheme.spacingSm),
                    ],
                    Flexible(
                      child: Text(
                        label,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: buttonColor,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Danger button for destructive actions (delete, logout, etc.)
class DangerButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool isFullWidth;
  final bool isOutlined;
  final bool isLoading;

  const DangerButton({
    super.key,
    required this.label,
    this.icon,
    required this.onPressed,
    this.isFullWidth = false,
    this.isOutlined = false,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isDisabled = onPressed == null && !isLoading;

    return SizedBox(
      width: isFullWidth ? double.infinity : null,
      height: 48,
      child: Opacity(
        opacity: isDisabled ? 0.5 : 1.0,
        child: Container(
          decoration: isOutlined
              ? AppTheme.cardDecoration(
                  colorScheme,
                  color: Colors.transparent,
                  borderColor: colorScheme.error,
                  borderWidth: 2,
                )
              : AppTheme.cardDecoration(
                  colorScheme,
                  color: colorScheme.error,
                ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: isDisabled || isLoading ? null : onPressed,
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
                    if (isLoading) ...[
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            isOutlined ? colorScheme.error : colorScheme.onError,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppTheme.spacingSm),
                    ] else if (icon != null) ...[
                      Icon(
                        icon,
                        color: isOutlined ? colorScheme.error : colorScheme.onError,
                        size: 18,
                      ),
                      const SizedBox(width: AppTheme.spacingSm),
                    ],
                    Flexible(
                      child: Text(
                        label,
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isOutlined ? colorScheme.error : colorScheme.onError,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Text button for tertiary actions
class TextButton extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback onPressed;
  final Color? color;

  const TextButton({
    super.key,
    required this.label,
    this.icon,
    required this.onPressed,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final buttonColor = color ?? colorScheme.primary;

    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingSm,
          vertical: AppTheme.spacingSm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, color: buttonColor, size: 18),
              const SizedBox(width: AppTheme.spacingSm),
            ],
            Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: buttonColor,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
