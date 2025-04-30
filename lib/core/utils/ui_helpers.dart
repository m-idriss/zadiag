import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'dart:math';
import 'package:zadiag/core/constants/app_theme.dart';

BoxDecoration buildBackground(ColorScheme colorScheme) {
  return BoxDecoration(
    gradient: LinearGradient(
      colors: [colorScheme.surfaceContainer, colorScheme.surfaceContainerHigh],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    ),
  );
}

void showSnackBar(BuildContext context, String message) {
  ScaffoldMessenger.of(context).clearSnackBars();
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      showCloseIcon: true,
      content: Text(
        message,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 16,
          fontFamily: AppTheme.defaultFontFamilyName,
          color: Theme.of(context).colorScheme.onTertiary,
        ),
      ),
      backgroundColor: Theme.of(context).colorScheme.tertiary,
      behavior: SnackBarBehavior.floating,
      margin: const EdgeInsets.only(top: 20, left: 16, right: 16, bottom: 662),
      duration: const Duration(seconds: 1),
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
      Text(
        title,
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          fontFamily: AppTheme.defaultFontFamilyName,
          color: Theme.of(context).colorScheme.onPrimaryContainer,
        ),
        textAlign: TextAlign.center,
      ),
      const SizedBox(height: 12),
      Text(
        subtitle,
        style: TextStyle(
          fontSize: 16,
          color: Theme.of(context).colorScheme.onPrimaryContainer,
          fontFamily: AppTheme.defaultFontFamilyName,
        ),
        textAlign: TextAlign.center,
      ),
    ],
  );
}

String buildDayOfWeek(context, int index) {
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

buildSettingsButton(
  BuildContext context,
  String action,
  IconData icon,
  Function() onPressed,
) {
  return _buildButton(context, action, icon, onPressed, 18);
}

buildConnectButton(
  BuildContext context,
  String action,
  IconData icon,
  Function() onPressed,
) {
  return _buildButton(context, action, icon, onPressed, 24);
}

_buildButton(
  BuildContext context,
  String action,
  IconData icon,
  Function() onPressed,
  double width,
) {
  return ElevatedButton.icon(
    onPressed: onPressed,
    style: ElevatedButton.styleFrom(
      backgroundColor: Theme.of(context).colorScheme.primary,
      padding: EdgeInsets.symmetric(horizontal: width, vertical: width / 2),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    icon: Icon(icon, color: Theme.of(context).colorScheme.onPrimary),
    label: Text(
      action,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onPrimary,
        fontSize: 18,
        fontFamily: AppTheme.defaultFontFamilyName,
        fontWeight: FontWeight.w600,
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
      color: Theme.of(context).colorScheme.primary,
      fontSize: 16,
      fontFamily: AppTheme.defaultFontFamilyName,
    ),
    prefixIcon: Padding(
      padding: const EdgeInsets.all(12),
      child: SvgPicture.asset(
        iconPath,
        colorFilter: ColorFilter.mode(
          Theme.of(context).colorScheme.primary,
          BlendMode.srcIn,
        ),
      ),
    ),
    suffixIcon: suffixIcon,
    contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
    enabledBorder: OutlineInputBorder(
      borderSide: BorderSide(color: Theme.of(context).colorScheme.outline),
      borderRadius: BorderRadius.circular(16),
    ),
    focusedBorder: OutlineInputBorder(
      borderSide: BorderSide(color: Theme.of(context).colorScheme.primary),
      borderRadius: BorderRadius.circular(16),
    ),
    filled: true,
    fillColor: Theme.of(context).colorScheme.outline,
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
      color: Theme.of(context).colorScheme.primary,
      fontSize: 16,
      fontFamily: AppTheme.defaultFontFamilyName,
    ),
    obscureText: obscureText,
    keyboardType: keyboardType,
    decoration: inputDecoration(
      context,
      hintText,
      iconPath,
      suffixIconPath != null
          ? GestureDetector(
            onTap: onSuffixTap,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: SvgPicture.asset(
                suffixIconPath,
                colorFilter: ColorFilter.mode(
                  Theme.of(context).colorScheme.primary,
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
    color: Theme.of(
      context,
    ).colorScheme.tertiaryContainer.withValues(alpha: 0.9),
    borderRadius: const BorderRadius.all(Radius.circular(16)),
    boxShadow: [
      BoxShadow(
        color: Theme.of(context).colorScheme.shadow.withValues(alpha: 0.4),
        offset: const Offset(0, 20),
        blurRadius: 20,
      ),
    ],
  );
}
