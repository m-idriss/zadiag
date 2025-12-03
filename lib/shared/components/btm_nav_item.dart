import 'package:flutter/material.dart';
import 'package:rive/rive.dart';
import 'package:zadiag/core/constants/app_theme.dart';

import '../models/menu.dart';

class BtmNavItem extends StatelessWidget {
  const BtmNavItem({
    super.key,
    required this.navBar,
    required this.press,
    required this.riveOnInit,
    required this.selectedNav,
    required this.label,
  });

  final Menu navBar;
  final VoidCallback press;
  final ValueChanged<Artboard> riveOnInit;
  final Menu selectedNav;
  final String label;

  @override
  Widget build(BuildContext context) {
    final isSelected = selectedNav == navBar;
    final colorScheme = Theme.of(context).colorScheme;
    
    return GestureDetector(
      onTap: press,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOutCubic,
              height: 28,
              width: 28,
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 200),
                opacity: isSelected ? 1 : 0.5,
                child: RiveAnimation.asset(
                  navBar.rive.src,
                  artboard: navBar.rive.artboard,
                  onInit: riveOnInit,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                color: isSelected 
                    ? colorScheme.primary 
                    : colorScheme.onSurface.withValues(alpha: 0.6),
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
