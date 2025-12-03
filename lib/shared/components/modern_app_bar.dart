import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// A modern, minimal AppBar widget for consistent header styling across screens.
///
/// This component provides a clean, minimalist AppBar design with a title,
/// optional subtitle, and optional leading/trailing actions.
class ModernAppBar extends StatelessWidget {
  /// The main title text displayed in the AppBar.
  final String title;

  /// Optional subtitle text displayed below the title.
  final String? subtitle;

  /// Optional leading widget (e.g., back button).
  final Widget? leading;

  /// Optional list of trailing action widgets.
  final List<Widget>? actions;

  /// Whether to center the title and subtitle.
  final bool centerTitle;

  const ModernAppBar({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.actions,
    this.centerTitle = true,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.only(
        top: AppTheme.spacingMd,
        bottom: AppTheme.spacingSm,
      ),
      child: Row(
        children: [
          // Leading widget
          if (leading != null) ...[
            leading!,
            const SizedBox(width: AppTheme.spacingSm),
          ],

          // Title section
          Expanded(
            child: Column(
              crossAxisAlignment:
                  centerTitle ? CrossAxisAlignment.center : CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    fontFamily: AppTheme.defaultFontFamilyName,
                    color: colorScheme.onSurface,
                    letterSpacing: -0.5,
                  ),
                  textAlign: centerTitle ? TextAlign.center : TextAlign.start,
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: AppTheme.spacingXs),
                  Text(
                    subtitle!,
                    style: TextStyle(
                      fontSize: 14,
                      fontFamily: AppTheme.defaultFontFamilyName,
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                      height: 1.4,
                    ),
                    textAlign: centerTitle ? TextAlign.center : TextAlign.start,
                  ),
                ],
              ],
            ),
          ),

          // Actions
          if (actions != null && actions!.isNotEmpty) ...[
            const SizedBox(width: AppTheme.spacingSm),
            ...actions!,
          ],
        ],
      ),
    );
  }
}
