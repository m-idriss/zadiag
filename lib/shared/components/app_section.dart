import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// A section component for grouping related UI elements.
/// Provides a title and optional description with consistent spacing.
class AppSection extends StatelessWidget {
  final String? title;
  final String? description;
  final List<Widget> children;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? backgroundColor;
  final bool showBackground;

  const AppSection({
    super.key,
    this.title,
    this.description,
    required this.children,
    this.padding,
    this.margin,
    this.backgroundColor,
    this.showBackground = true,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      margin: margin,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Section header
          if (title != null) ...[
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
                vertical: AppTheme.spacingSm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title!,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: colorScheme.onSurface.withValues(alpha: 0.6),
                          letterSpacing: 0.5,
                        ),
                  ),
                  if (description != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      description!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: colorScheme.onSurface.withValues(alpha: 0.5),
                          ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppTheme.spacingSm),
          ],
          // Section content
          if (showBackground)
            Container(
              decoration: AppTheme.cardDecoration(
                colorScheme,
                color: backgroundColor ?? colorScheme.surface,
              ),
              padding: padding ?? const EdgeInsets.symmetric(vertical: AppTheme.spacingSm),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: children,
              ),
            )
          else
            Column(
              mainAxisSize: MainAxisSize.min,
              children: children,
            ),
        ],
      ),
    );
  }
}
