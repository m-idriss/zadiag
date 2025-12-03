import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'dart:math';
import 'package:zadiag/core/constants/app_theme.dart';

/// Common UI helper functions used across the application.
/// 
/// This file contains reusable utility functions for building
/// consistent UI elements throughout the app.

/// Builds a gradient background decoration using theme colors.
BoxDecoration buildBackground(ColorScheme colorScheme) {
  return BoxDecoration(
    gradient: LinearGradient(
      colors: [
        colorScheme.surface,
        colorScheme.surfaceContainerHigh,
      ],
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
    ),
  );
}

/// Shows a floating snackbar with a message.
/// 
/// [context] - The build context for the snackbar.
/// [message] - The message to display.
/// [isError] - Whether this is an error message (shows in red).
void showSnackBar(BuildContext context, String message, [bool isError = false]) {
  ScaffoldMessenger.of(context).clearSnackBars();
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      showCloseIcon: true,
      closeIconColor: Colors.white,
      content: Row(
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.check_circle_outline,
            color: Colors.white,
            size: 20,
          ),
          const SizedBox(width: AppTheme.spacingSm),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 14,
                fontFamily: AppTheme.defaultFontFamilyName,
                fontWeight: FontWeight.w500,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: isError
          ? Colors.redAccent
          : Colors.greenAccent.shade700,
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.all(AppTheme.spacingMd),
      duration: const Duration(seconds: 2),
      elevation: 8,
    ),
  );
}

/// Generates random heat map data for the past 365 days.
/// 
/// Returns a map where keys are dates and values are activity levels (0-4).
Map<DateTime, int> generateRandomHeatMapData() {
  Map<DateTime, int> heatMapDatasets = {};
  final now = DateTime.now();
  for (int i = 0; i < 365; i++) {
    final date = now.subtract(Duration(days: i + 1));
    DateTime day = DateTime(date.year, date.month, date.day);
    heatMapDatasets[day] = Random().nextInt(5);
  }
  return heatMapDatasets;
}

/// Builds a page header with title and subtitle.
Column buildHeader(BuildContext context, String title, String subtitle) {
  return Column(
    children: [
      const SizedBox(height: AppTheme.spacingMd),
      Text(
        title,
        style: AppTheme.headingStyle(
          Theme.of(context).colorScheme.onSurface,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: AppTheme.spacingSm),
      Text(
        subtitle,
        style: AppTheme.bodyStyle(
          Theme.of(context).colorScheme.onSurface,
          alpha: 0.7,
        ),
        textAlign: TextAlign.center,
      ),
    ],
  );
}

/// Returns the localized day of week name for a given index (0 = Sunday).
String buildDayOfWeek(BuildContext context, int index) {
  switch (index) {
    case 0:
      return trad(context)!.cal_sunday;
    case 1:
      return trad(context)!.cal_monday;
    case 2:
      return trad(context)!.cal_tuesday;
    case 3:
      return trad(context)!.cal_wednesday;
    case 4:
      return trad(context)!.cal_thursday;
    case 5:
      return trad(context)!.cal_friday;
    case 6:
      return trad(context)!.cal_saturday;
    default:
      return '';
  }
}

/// Builds a small settings-style gradient button.
Widget buildSettingsButton(
  BuildContext context,
  String action,
  IconData icon,
  VoidCallback onPressed,
) {
  return _buildButton(context, action, icon, onPressed, 16, false);
}

/// Builds a large connect-style gradient button for auth screens.
Widget buildConnectButton(
  BuildContext context,
  String action,
  IconData icon,
  VoidCallback onPressed,
) {
  return _buildButton(context, action, icon, onPressed, 20, true);
}

/// Internal helper to build gradient action buttons.
Widget _buildButton(
  BuildContext context,
  String action,
  IconData icon,
  VoidCallback onPressed,
  double padding,
  bool isLarge,
) {
  return Container(
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(AppTheme.radiusLg),
      gradient: LinearGradient(
        colors: [
          Theme.of(context).colorScheme.primary,
          Theme.of(context).colorScheme.secondary,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      boxShadow: [
        BoxShadow(
          color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.3),
          blurRadius: 12,
          offset: const Offset(0, 6),
        ),
      ],
    ),
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: padding + 8,
            vertical: padding / 2 + 4,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                color: Colors.white,
                size: isLarge ? 22 : 18,
              ),
              SizedBox(width: isLarge ? 12 : 8),
              Flexible(
                child: Text(
                  action,
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                  softWrap: false,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: isLarge ? 16 : 14,
                    fontFamily: AppTheme.defaultFontFamilyName,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Creates a styled input decoration with an SVG prefix icon.
/// 
/// [hintText] - Placeholder text for the input.
/// [iconPath] - Path to the SVG icon asset.
/// [suffixIcon] - Optional suffix widget (e.g., password visibility toggle).
InputDecoration inputDecoration(
  BuildContext context,
  String hintText,
  String iconPath, [
  Widget? suffixIcon,
]) {
  return InputDecoration(
    hintText: hintText,
    hintStyle: TextStyle(
      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
      fontSize: 14,
      fontFamily: AppTheme.defaultFontFamilyName,
    ),
    prefixIcon: Padding(
      padding: const EdgeInsets.all(14),
      child: SvgPicture.asset(
        iconPath,
        width: 20,
        height: 20,
        colorFilter: ColorFilter.mode(
          Theme.of(context).colorScheme.primary,
          BlendMode.srcIn,
        ),
      ),
    ),
    suffixIcon: suffixIcon,
    contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
    enabledBorder: OutlineInputBorder(
      borderSide: BorderSide(
        color: Theme.of(context).colorScheme.outline,
        width: 1.5,
      ),
      borderRadius: BorderRadius.circular(AppTheme.radiusLg),
    ),
    focusedBorder: OutlineInputBorder(
      borderSide: BorderSide(
        color: Theme.of(context).colorScheme.primary,
        width: 2,
      ),
      borderRadius: BorderRadius.circular(AppTheme.radiusLg),
    ),
    errorBorder: OutlineInputBorder(
      borderSide: BorderSide(
        color: Theme.of(context).colorScheme.error,
        width: 1.5,
      ),
      borderRadius: BorderRadius.circular(AppTheme.radiusLg),
    ),
    focusedErrorBorder: OutlineInputBorder(
      borderSide: BorderSide(
        color: Theme.of(context).colorScheme.error,
        width: 2,
      ),
      borderRadius: BorderRadius.circular(AppTheme.radiusLg),
    ),
    filled: true,
    fillColor: Theme.of(context).colorScheme.surface,
  );
}

/// Creates a dropdown decoration (uses the same style as input decoration).
InputDecoration dropdownDecoration(
  BuildContext context,
  String label,
  String iconPath,
) {
  return inputDecoration(context, label, iconPath);
}

/// Builds a styled text form field with consistent theming.
/// 
/// [controller] - The text editing controller.
/// [hintText] - Placeholder text.
/// [iconPath] - Path to the prefix SVG icon.
/// [keyboardType] - Keyboard type for input.
/// [obscureText] - Whether to hide text (for passwords).
/// [suffixIconPath] - Optional suffix icon path (e.g., for password toggle).
/// [onSuffixTap] - Callback when suffix icon is tapped.
Widget buildTextField({
  required BuildContext context,
  required TextEditingController controller,
  required String hintText,
  required String iconPath,
  TextInputType keyboardType = TextInputType.text,
  bool obscureText = false,
  String? suffixIconPath,
  VoidCallback? onSuffixTap,
}) {
  return TextFormField(
    controller: controller,
    style: AppTheme.bodyStyle(Theme.of(context).colorScheme.onSurface),
    obscureText: obscureText,
    keyboardType: keyboardType,
    cursorColor: Theme.of(context).colorScheme.primary,
    decoration: inputDecoration(
      context,
      hintText,
      iconPath,
      suffixIconPath != null
          ? GestureDetector(
            onTap: onSuffixTap,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: SvgPicture.asset(
                suffixIconPath,
                width: 20,
                height: 20,
                colorFilter: ColorFilter.mode(
                  Theme.of(context).colorScheme.primary.withValues(alpha: 0.7),
                  BlendMode.srcIn,
                ),
              ),
            ),
          )
          : null,
    ),
  );
}

/// Creates a decoration for the bottom navigation menu with glassmorphism effect.
BoxDecoration bottomMenu(BuildContext context) {
  return BoxDecoration(
    color: Theme.of(context).colorScheme.surfaceDim.withValues(alpha: 0.95),
    borderRadius: BorderRadius.circular(AppTheme.radiusXl),
    border: Border.all(
      color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.2),
      width: 1,
    ),
    boxShadow: [
      BoxShadow(
        color: Theme.of(context).colorScheme.shadow.withValues(alpha: 0.15),
        offset: const Offset(0, -4),
        blurRadius: 20,
      ),
    ],
  );
}
