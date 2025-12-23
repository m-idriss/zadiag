import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// A standardized scaffold component for consistent screen layouts.
/// Provides header, body, and optional bottom navigation with safe area handling.
class AppScaffold extends StatelessWidget {
  final String? title;
  final Widget? titleWidget;
  final List<Widget>? actions;
  final Widget body;
  final Widget? bottomNavigationBar;
  final Widget? floatingActionButton;
  final bool showBackButton;
  final VoidCallback? onBackPressed;
  final bool extendBodyBehindAppBar;
  final Color? backgroundColor;
  final PreferredSizeWidget? appBar;
  final bool useGradientBackground;

  const AppScaffold({
    super.key,
    this.title,
    this.titleWidget,
    this.actions,
    required this.body,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.showBackButton = false,
    this.onBackPressed,
    this.extendBodyBehindAppBar = false,
    this.backgroundColor,
    this.appBar,
    this.useGradientBackground = false,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      extendBodyBehindAppBar: extendBodyBehindAppBar,
      appBar: appBar ??
          (title != null || titleWidget != null
              ? AppBar(
                  title: titleWidget ??
                      Text(
                        title!,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: colorScheme.onSurface,
                            ),
                      ),
                  backgroundColor: Colors.transparent,
                  elevation: 0,
                  leading: showBackButton
                      ? IconButton(
                          icon: const Icon(Icons.arrow_back_ios_rounded),
                          onPressed: onBackPressed ?? () => Navigator.of(context).pop(),
                          color: colorScheme.onSurface,
                        )
                      : null,
                  actions: actions,
                )
              : null),
      body: useGradientBackground
          ? Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    colorScheme.primary.withValues(alpha: 0.05),
                    colorScheme.tertiary,
                    colorScheme.secondary.withValues(alpha: 0.05),
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
              child: body,
            )
          : Container(
              color: backgroundColor ?? colorScheme.tertiary,
              child: body,
            ),
      bottomNavigationBar: bottomNavigationBar,
      floatingActionButton: floatingActionButton,
    );
  }
}
