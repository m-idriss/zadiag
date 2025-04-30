import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';

Container title(BuildContext context, String title) {
  return Container(
    margin: const EdgeInsets.only(top: 60, bottom: 12),
    child: Text(
      title,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onPrimaryContainer,
        fontWeight: FontWeight.w700,
        fontFamily: AppTheme.defaultFontFamilyName,
        fontSize: 20,
      ),
    ),
  );
}

Container subtitle(BuildContext context, String subtitle) {
  return Container(
    margin: EdgeInsets.only(bottom: 32),
    child: Text(
      subtitle,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onPrimaryContainer,
        fontSize: 12,
        height: 150 / 100,
      ),
    ),
  );
}

Widget signButton(
  BuildContext context,
  IconData icon,
  String text,
  StatefulWidget? page,
  VoidCallback? onTap,
) {
  return Container(
    margin: const EdgeInsets.symmetric(vertical: 16),
    width: double.infinity,
    child: buildConnectButton(context, text, icon, () {
      if (onTap != null) {
        onTap();
      } else if (page != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => page),
          );
        });
      }
    }),
  );
}

Container orConnectWithText(BuildContext context, String text) {
  return Container(
    margin: EdgeInsets.only(top: 32, bottom: 12),
    child: Text(
      text,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onPrimaryContainer,
        fontSize: 12,
        height: 150 / 100,
      ),
    ),
  );
}

Container socialButtons(BuildContext context) {
  return Container(
    margin: EdgeInsets.only(bottom: 32),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _socialIcon(context, 'Apple'),
        _socialIcon(context, 'Google'),
        _socialIcon(context, 'Facebook'),
      ],
    ),
  );
}

Container _socialIcon(BuildContext context, String iconUrl) {
  return Container(
    margin: EdgeInsets.only(right: 16, left: 16),
    child: SvgPicture.asset(
      'assets/icons/$iconUrl.svg',
      width: 32,
      height: 32,
      colorFilter: ColorFilter.mode(
        Theme.of(context).colorScheme.primary,
        BlendMode.srcIn,
      ),
    ),
  );
}

Widget bottom(BuildContext context, StatefulWidget page, String text) {
  return Container(
    height: 48,
    alignment: Alignment.center,
    child: TextButton(
      onPressed: () {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => page),
          );
        });
      },
      child: Text(
        text,
        style: TextStyle(
          color: Theme.of(context).colorScheme.onPrimaryContainer,
        ),
      ),
    ),
  );
}
