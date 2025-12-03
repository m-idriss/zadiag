import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/shared/components/glass_container.dart';

class ZadiagLogo extends StatelessWidget {
  final double size;
  final double fontSize;

  const ZadiagLogo({super.key, this.size = 120, this.fontSize = 48});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return GlassContainer(
      width: size,
      height: size,
      borderRadius: 30,
      child: Center(
        child: Container(
          width: size * 0.66,
          height: size * 0.66,
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: colorScheme.primary.withValues(alpha: 0.3),
                blurRadius: 15,
                spreadRadius: 2,
              ),
            ],
          ),
          child: Center(
            child: Text(
              'Z',
              style: TextStyle(
                fontSize: fontSize,
                fontWeight: FontWeight.w900,
                fontFamily: AppTheme.defaultFontFamilyName,
                color: colorScheme.primary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
