import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// A custom text field component following the design system.
/// Provides consistent styling and behavior across the app.
class AppTextField extends StatelessWidget {
  final TextEditingController? controller;
  final String? labelText;
  final String? hintText;
  final String? helperText;
  final String? errorText;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final int? maxLines;
  final int? minLines;
  final ValueChanged<String>? onChanged;
  final FormFieldValidator<String>? validator;
  final bool readOnly;
  final VoidCallback? onTap;
  final bool enabled;

  const AppTextField({
    super.key,
    this.controller,
    this.labelText,
    this.hintText,
    this.helperText,
    this.errorText,
    this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.keyboardType,
    this.maxLines = 1,
    this.minLines,
    this.onChanged,
    this.validator,
    this.readOnly = false,
    this.onTap,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      maxLines: maxLines,
      minLines: minLines,
      onChanged: onChanged,
      validator: validator,
      readOnly: readOnly,
      onTap: onTap,
      enabled: enabled,
      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: colorScheme.onSurface,
          ),
      decoration: InputDecoration(
        labelText: labelText,
        hintText: hintText,
        helperText: helperText,
        errorText: errorText,
        prefixIcon: prefixIcon != null
            ? Icon(
                prefixIcon,
                color: colorScheme.primary,
              )
            : null,
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: colorScheme.surface,
        contentPadding: const EdgeInsets.all(AppTheme.spacingMd),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          borderSide: BorderSide(color: colorScheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          borderSide: BorderSide(color: colorScheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          borderSide: BorderSide(color: colorScheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          borderSide: BorderSide(color: colorScheme.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          borderSide: BorderSide(color: colorScheme.error, width: 2),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          borderSide: BorderSide(color: colorScheme.outline.withValues(alpha: 0.5)),
        ),
      ),
    );
  }
}
