import 'package:flutter/material.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/shared/components/glass_scaffold.dart';

class CaptureScreen extends StatelessWidget {
  const CaptureScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.all(AppTheme.spacingLg),
          physics: const BouncingScrollPhysics(),
          children: [
            _header(context),
            const SizedBox(height: AppTheme.spacingLg),
            _cameraView(context),
            const SizedBox(height: AppTheme.spacingXl),
            _actionButtons(context),
          ],
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: AppTheme.spacingMd),
        Text(
          trad(context)!.capture_title,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontFamily: AppTheme.defaultFontFamilyName,
            fontSize: 32,
            shadows: [
              Shadow(
                color: Colors.black.withValues(alpha: 0.2),
                offset: const Offset(0, 2),
                blurRadius: 4,
              ),
            ],
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppTheme.spacingSm),
        Text(
          trad(context)!.capture_subtitle,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.9),
            fontSize: 16,
            height: 1.5,
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _cameraView(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      height: 240,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            colorScheme.primary.withValues(alpha: 0.05),
            colorScheme.secondary.withValues(alpha: 0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
        border: Border.all(color: colorScheme.outline, width: 2),
        boxShadow: [
          BoxShadow(
            color: colorScheme.primary.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Camera placeholder
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: colorScheme.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.camera_alt_rounded,
              size: 48,
              color: colorScheme.primary,
            ),
          ),
          // Corner decorations
          Positioned(top: 16, left: 16, child: _cornerDecoration(colorScheme)),
          Positioned(
            top: 16,
            right: 16,
            child: Transform.scale(
              scaleX: -1,
              child: _cornerDecoration(colorScheme),
            ),
          ),
          Positioned(
            bottom: 16,
            left: 16,
            child: Transform.scale(
              scaleY: -1,
              child: _cornerDecoration(colorScheme),
            ),
          ),
          Positioned(
            bottom: 16,
            right: 16,
            child: Transform.scale(
              scale: -1,
              child: _cornerDecoration(colorScheme),
            ),
          ),
        ],
      ),
    );
  }

  Widget _cornerDecoration(ColorScheme colorScheme) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(color: colorScheme.primary, width: 3),
          top: BorderSide(color: colorScheme.primary, width: 3),
        ),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(AppTheme.radiusSm),
        ),
      ),
    );
  }

  Widget _actionButtons(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Expanded(
          child: _buildGradientButton(
            context,
            trad(context)!.take_photo,
            Icons.camera_alt_rounded,
            () {},
          ),
        ),
      ],
    );
  }

  Widget _buildGradientButton(
    BuildContext context,
    String label,
    IconData icon,
    VoidCallback onTap,
  ) {
    return Container(
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primary,
            Theme.of(context).colorScheme.secondary,
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.4),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusXxl),
          child: Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: Colors.white, size: 22),
                SizedBox(width: AppTheme.spacingSm),
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
