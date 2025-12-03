import 'package:flutter/material.dart';

import 'package:zadiag/shared/components/glass_container.dart';
import 'package:flutter_svg/flutter_svg.dart';

class ZadiagLogo extends StatelessWidget {
  final double size;

  const ZadiagLogo({super.key, this.size = 120});

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
            child: SvgPicture.asset(
              'assets/logo/icon.svg',
              width: size * 0.4,
              height: size * 0.4,
            ),
          ),
        ),
      ),
    );
  }
}
