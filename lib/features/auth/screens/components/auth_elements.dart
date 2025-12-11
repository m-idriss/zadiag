import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/navigation_helper.dart';

/// Reusable authentication UI components.
/// 
/// This file contains shared widgets and components used across
/// authentication-related screens (login, register, etc.).

/// Builds a title container with consistent styling for auth screens.
Container title(BuildContext context, String title) {
  return Container(
    margin: EdgeInsets.only(top: AppTheme.spacingMd, bottom: AppTheme.spacingMd),
    child: Text(
      title,
      textAlign: TextAlign.center,
      style: AppTheme.headingStyle(
        Theme.of(context).colorScheme.onSurface,
      ),
    ),
  );
}

/// Builds a subtitle container with consistent styling for auth screens.
Container subtitle(BuildContext context, String subtitle) {
  return Container(
    margin: EdgeInsets.only(bottom: AppTheme.spacingMd),
    child: Text(
      subtitle,
      textAlign: TextAlign.center,
      style: AppTheme.bodyStyle(
        Theme.of(context).colorScheme.onSurface,
        alpha: 0.7,
      ),
    ),
  );
}

/// Builds a primary action button for sign-in/sign-up flows.
/// 
/// If [onTap] is provided, it will be called when the button is pressed.
/// If [page] is provided instead, the app will navigate to that page.
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
        NavigationHelper.navigateWithFadePostFrame(context, page);
      }
    }),
  );
}

/// Builds an "Or connect with" divider text for social login sections.
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
            style: AppTheme.labelStyle(
              Theme.of(context).colorScheme.onSurface,
            ).copyWith(fontWeight: FontWeight.w500),
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

/// Builds a row of social login buttons (Google, Apple, Facebook).
Container socialButtons(BuildContext context) {
  return Container(
    margin: EdgeInsets.only(bottom: AppTheme.spacingXl),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // TODO: Implement Apple sign-in
        // _socialIcon(context, 'Apple'),
        _socialIcon(context, 'Google'),
        // TODO: Implement Facebook sign-in
        // _socialIcon(context, 'Facebook'),
      ],
    ),
  );
}

/// Builds a single social login icon button.
Widget _socialIcon(BuildContext context, String iconName) {
  final colorScheme = Theme.of(context).colorScheme;
  
  return Container(
    margin: EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          // TODO: Implement social login functionality
        },
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        child: Container(
          width: 56,
          height: 56,
          decoration: AppTheme.cardDecoration(
            colorScheme,
            color: colorScheme.surface,
            borderColor: colorScheme.outline,
            borderWidth: 1.5,
          ).copyWith(
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
              'assets/icons/$iconName.svg',
              width: 24,
              height: 24,
              colorFilter: ColorFilter.mode(
                colorScheme.primary,
                BlendMode.srcIn,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/// Builds a bottom navigation bar with a link to another auth page.
/// 
/// Used for "Already have an account?" / "Don't have an account?" links.
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
        NavigationHelper.navigateWithFadePostFrame(context, page);
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
