import 'package:flutter/material.dart';

/// Centralized navigation helper for consistent navigation patterns.
class NavigationHelper {
  /// Navigates to a new page with a fade transition, replacing the current route.
  static void navigateWithFade(
    BuildContext context,
    Widget destination, {
    Duration duration = const Duration(milliseconds: 300),
  }) {
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => destination,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: duration,
      ),
    );
  }

  /// Navigates to a new page with a fade transition, pushing onto the stack.
  static void pushWithFade(
    BuildContext context,
    Widget destination, {
    Duration duration = const Duration(milliseconds: 300),
  }) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => destination,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: duration,
      ),
    );
  }

  /// Pops the current route and returns the given result.
  static void pop<T>(BuildContext context, [T? result]) {
    Navigator.pop(context, result);
  }

  /// Schedules navigation after the current frame completes.
  /// Useful when navigating from build methods or callbacks.
  static void navigateWithFadePostFrame(
    BuildContext context,
    Widget destination, {
    Duration duration = const Duration(milliseconds: 300),
  }) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      navigateWithFade(context, destination, duration: duration);
    });
  }
}
