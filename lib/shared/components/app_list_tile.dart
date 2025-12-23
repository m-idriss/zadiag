import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// A reusable list tile component following the design system.
/// Used for settings items, menu items, and other list-based UI.
class AppListTile extends StatelessWidget {
  final IconData? leadingIcon;
  final Widget? leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? iconColor;
  final Color? backgroundColor;
  final bool showDivider;

  const AppListTile({
    super.key,
    this.leadingIcon,
    this.leading,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.iconColor,
    this.backgroundColor,
    this.showDivider = false,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final effectiveIconColor = iconColor ?? colorScheme.primary;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: backgroundColor ?? Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppTheme.spacingMd,
                vertical: AppTheme.spacingMd,
              ),
              child: Row(
                children: [
                  // Leading icon or widget
                  if (leadingIcon != null || leading != null) ...[
                    leading ??
                        Container(
                          padding: const EdgeInsets.all(AppTheme.spacingSm),
                          decoration: AppTheme.iconContainerDecoration(
                            colorScheme,
                            color: effectiveIconColor.withValues(alpha: 0.1),
                          ),
                          child: Icon(
                            leadingIcon,
                            color: effectiveIconColor,
                            size: 20,
                          ),
                        ),
                    const SizedBox(width: AppTheme.spacingMd),
                  ],
                  // Title and subtitle
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                fontWeight: FontWeight.w500,
                                color: colorScheme.onSurface,
                              ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            subtitle!,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                                ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  // Trailing widget
                  if (trailing != null) ...[
                    const SizedBox(width: AppTheme.spacingSm),
                    trailing!,
                  ],
                ],
              ),
            ),
          ),
        ),
        if (showDivider)
          Padding(
            padding: EdgeInsets.only(
              left: leadingIcon != null || leading != null
                  ? AppTheme.spacingMd * 2 + 36
                  : AppTheme.spacingMd,
            ),
            child: Divider(
              height: 1,
              thickness: 1,
              color: colorScheme.outline.withValues(alpha: 0.2),
            ),
          ),
      ],
    );
  }
}
