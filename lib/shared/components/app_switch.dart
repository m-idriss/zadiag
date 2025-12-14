import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// A custom switch component following the design system.
/// Provides consistent styling and behavior across the app.
class AppSwitch extends StatelessWidget {
  final bool value;
  final ValueChanged<bool>? onChanged;
  final Color? activeColor;
  final Color? trackColor;

  const AppSwitch({
    super.key,
    required this.value,
    required this.onChanged,
    this.activeColor,
    this.trackColor,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Switch(
      value: value,
      onChanged: onChanged,
      activeColor: activeColor ?? colorScheme.primary,
      activeTrackColor: (activeColor ?? colorScheme.primary).withValues(alpha: 0.5),
      inactiveThumbColor: colorScheme.outline,
      inactiveTrackColor: colorScheme.surfaceContainerHigh,
      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );
  }
}
