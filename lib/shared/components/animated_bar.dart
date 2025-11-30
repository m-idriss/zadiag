import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';

class AnimatedBar extends StatelessWidget {
  const AnimatedBar({super.key, required this.isActive});

  final bool isActive;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      margin: const EdgeInsets.only(bottom: 4),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      height: 4,
      width: isActive ? 24 : 0,
      decoration: BoxDecoration(
        gradient: isActive
            ? LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary,
                  Theme.of(context).colorScheme.secondary,
                ],
              )
            : null,
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
        boxShadow: isActive
            ? [
                BoxShadow(
                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.4),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
    );
  }
}
