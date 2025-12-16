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
        color: isActive ? Theme.of(context).colorScheme.primary : null,
        borderRadius: BorderRadius.circular(AppTheme.radiusFull),
      ),
    );
  }
}
