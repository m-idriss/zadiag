import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';

Container title(BuildContext context, String title) {
  return Container(
    margin: EdgeInsets.only(top: AppTheme.spacingXxl, bottom: AppTheme.spacingMd),
    child: Text(
      title,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurface,
        fontWeight: FontWeight.w700,
        fontFamily: AppTheme.defaultFontFamilyName,
        fontSize: 28,
        letterSpacing: -0.5,
      ),
    ),
  );
}

Container subtitle(BuildContext context, String subtitle) {
  return Container(
    margin: EdgeInsets.only(bottom: AppTheme.spacingXl),
    child: Text(
      subtitle,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
        fontSize: 14,
        height: 1.5,
        fontFamily: AppTheme.defaultFontFamilyName,
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
    margin: EdgeInsets.symmetric(vertical: AppTheme.spacingMd),
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
    margin: EdgeInsets.only(top: AppTheme.spacingXl, bottom: AppTheme.spacingMd),
    child: Row(
      children: [
        Expanded(
          child: Divider(
            color: Theme.of(context).colorScheme.outline,
            thickness: 1,
          ),
        ),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
          child: Text(
            text,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
              fontSize: 12,
              fontFamily: AppTheme.defaultFontFamilyName,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Expanded(
          child: Divider(
            color: Theme.of(context).colorScheme.outline,
            thickness: 1,
          ),
        ),
      ],
    ),
  );
}

Container socialButtons(BuildContext context) {
  return Container(
    margin: EdgeInsets.only(bottom: AppTheme.spacingXl),
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

Widget _socialIcon(BuildContext context, String iconUrl) {
  return Container(
    margin: EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(AppTheme.radiusLg),
            border: Border.all(
              color: Theme.of(context).colorScheme.outline,
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Center(
            child: SvgPicture.asset(
              'assets/icons/$iconUrl.svg',
              width: 24,
              height: 24,
              colorFilter: ColorFilter.mode(
                Theme.of(context).colorScheme.primary,
                BlendMode.srcIn,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

Widget bottom(BuildContext context, StatefulWidget page, String text) {
  return Container(
    height: 60,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface,
      border: Border(
        top: BorderSide(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.5),
          width: 1,
        ),
      ),
    ),
    child: TextButton(
      onPressed: () {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          Navigator.pushReplacement(
            context,
            PageRouteBuilder(
              pageBuilder: (context, animation, secondaryAnimation) => page,
              transitionsBuilder:
                  (context, animation, secondaryAnimation, child) {
                return FadeTransition(
                  opacity: animation,
                  child: child,
                );
              },
              transitionDuration: const Duration(milliseconds: 300),
            ),
          );
        });
      },
      style: TextButton.styleFrom(
        padding: EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm,
        ),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: Theme.of(context).colorScheme.primary,
          fontFamily: AppTheme.defaultFontFamilyName,
          fontWeight: FontWeight.w600,
          fontSize: 14,
        ),
      ),
    ),
  );
}
