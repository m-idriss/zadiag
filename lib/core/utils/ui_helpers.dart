import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'dart:math';
import 'package:zadiag/core/constants/app_theme.dart';

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
          const Icon(
            Icons.check_circle_outline,
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

Column buildHeader(BuildContext context, String title, String subtitle) {
  return Column(
    children: [
      const SizedBox(height: AppTheme.spacingMd),
      Text(
        title,
        style: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          fontFamily: AppTheme.defaultFontFamilyName,
          color: Theme.of(context).colorScheme.onSurface,
          letterSpacing: -0.5,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: AppTheme.spacingSm),
      Text(
        subtitle,
        style: TextStyle(
          fontSize: 14,
          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
          fontFamily: AppTheme.defaultFontFamilyName,
          height: 1.5,
        ),
        textAlign: TextAlign.center,
      ),
    ],
  );
}

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

dynamic buildSettingsButton(
  BuildContext context,
  String action,
  IconData icon,
  Function() onPressed,
) {
  return _buildButton(context, action, icon, onPressed, 16, false);
}

dynamic buildConnectButton(
  BuildContext context,
  String action,
  IconData icon,
  Function() onPressed,
) {
  return _buildButton(context, action, icon, onPressed, 20, true);
}

Widget _buildButton(
  BuildContext context,
  String action,
  IconData icon,
  Function() onPressed,
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

InputDecoration dropdownDecoration(
  BuildContext context,
  String label,
  String iconPath,
) {
  return inputDecoration(context, label, iconPath);
}

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
    style: TextStyle(
      color: Theme.of(context).colorScheme.onSurface,
      fontSize: 14,
      fontFamily: AppTheme.defaultFontFamilyName,
    ),
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

BoxDecoration bottomMenu(BuildContext context) {
  return BoxDecoration(
    color: Theme.of(context).colorScheme.surfaceDim,
    borderRadius: BorderRadius.circular(AppTheme.radiusXl),
    border: Border.all(
      color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.5),
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
