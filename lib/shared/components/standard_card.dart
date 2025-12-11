import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

class StandardCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? backgroundColor;

  const StandardCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding,
    this.margin,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: backgroundColor, // Falls back to CardTheme.color if null
      margin: margin, // Falls back to CardTheme.margin if null
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: padding ?? const EdgeInsets.all(AppTheme.spacingMd),
          child: child,
        ),
      ),
    );
  }
}
