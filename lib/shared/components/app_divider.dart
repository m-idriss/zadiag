import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// A divider component for separating sections.
/// Provides consistent spacing and styling.
class AppDivider extends StatelessWidget {
  final double? height;
  final double? thickness;
  final double? indent;
  final double? endIndent;
  final Color? color;

  const AppDivider({
    super.key,
    this.height,
    this.thickness,
    this.indent,
    this.endIndent,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Divider(
      height: height ?? AppTheme.spacingMd,
      thickness: thickness ?? 1,
      indent: indent,
      endIndent: endIndent,
      color: color ?? colorScheme.outline.withValues(alpha: 0.2),
    );
  }
}

/// A vertical divider component for separating horizontal elements.
class AppVerticalDivider extends StatelessWidget {
  final double? width;
  final double? thickness;
  final double? indent;
  final double? endIndent;
  final Color? color;

  const AppVerticalDivider({
    super.key,
    this.width,
    this.thickness,
    this.indent,
    this.endIndent,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return VerticalDivider(
      width: width ?? AppTheme.spacingMd,
      thickness: thickness ?? 1,
      indent: indent,
      endIndent: endIndent,
      color: color ?? colorScheme.outline.withValues(alpha: 0.2),
    );
  }
}
