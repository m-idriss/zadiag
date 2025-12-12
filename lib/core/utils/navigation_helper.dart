import 'package:flutter/material.dart';

/// Centralized navigation helper for consistent navigation patterns.
class NavigationHelper {
  /// Creates a PageRouteBuilder with a right-to-left slide transition.
  static PageRouteBuilder _createSlideRoute(
    Widget destination,
    Duration duration,
  ) {
    return PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) => destination,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(1.0, 0.0),
            end: Offset.zero,
          ).animate(
            CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            ),
          ),
          child: child,
        );
      },
      transitionDuration: duration,
    );
  }

  /// Creates a PageRouteBuilder with a fade transition.
  static PageRouteBuilder _createFadeRoute(
    Widget destination,
    Duration duration,
  ) {
    return PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) => destination,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return FadeTransition(opacity: animation, child: child);
      },
      transitionDuration: duration,
    );
  }

  /// Navigates to a new page with a right-to-left slide transition, replacing the current route.
  static void navigateWithSlide(
    BuildContext context,
    Widget destination, {
    Duration duration = const Duration(milliseconds: 300),
  }) {
    Navigator.pushReplacement(
      context,
      _createSlideRoute(destination, duration),
    );
  }

  /// Navigates to a new page with a right-to-left slide transition, pushing onto the stack.
  static void pushWithSlide(
    BuildContext context,
    Widget destination, {
    Duration duration = const Duration(milliseconds: 300),
  }) {
    Navigator.push(
      context,
      _createSlideRoute(destination, duration),
    );
  }

  /// Navigates to a new page with a fade transition, replacing the current route.
  static void navigateWithFade(
    BuildContext context,
    Widget destination, {
    Duration duration = const Duration(milliseconds: 300),
  }) {
    Navigator.pushReplacement(
      context,
      _createFadeRoute(destination, duration),
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
      _createFadeRoute(destination, duration),
    );
  }

  /// Pops the current route and returns the given result.
  static void pop<T>(BuildContext context, [T? result]) {
    Navigator.pop(context, result);
  }

  /// Schedules navigation with slide transition after the current frame completes.
  /// Useful when navigating from build methods or callbacks.
  static void navigateWithSlidePostFrame(
    BuildContext context,
    Widget destination, {
    Duration duration = const Duration(milliseconds: 300),
  }) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      navigateWithSlide(context, destination, duration: duration);
    });
  }

  /// Schedules navigation with fade transition after the current frame completes.
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
