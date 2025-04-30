import 'package:flutter/material.dart';

class AppTheme {
  // Light Theme Colors
  static const Color lightPrimary = Color(0xFF06014A);
  static const Color lightOnPrimary = Color(0xFFFFFFFF);
  static const Color lightSecondary = Color(0xFF5C6BC0);
  static const Color lightOnSecondary = Color(0xFFFFFFFF);
  static const Color lightTertiary = Color(0xFFFFFFFF);
  static const Color lightOnTertiary = Color(0xFF07D826);
  static const Color lightError = Color(0xFFB00020);
  static const Color lightOnError = Color(0xFFFFFFFF);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightOnSurface = Color(0xFF1A1C2D);
  static const Color lightOutline = Color(0xFFDEE7FF);
  static const Color lightOutlineVariant = Color(0xFF3D5AFE);
  static const Color lightSurfaceContainerHigh = Color(0xFFEAEAF2);
  static const Color lightSurfaceContainer = Color(0xFFEAEAF2);

  // Dark Theme Colors
  static const Color darkPrimary = Color(0xFF06014A);
  static const Color darkOnPrimary = Color(0xFF025390);
  static const Color darkSecondary = Color(0xFF1153D7);
  static const Color darkOnSecondary = Color(0xFFFFFFFF);
  static const Color darkTertiary = Color(0xFF025390);
  static const Color darkOnTertiary = Color(0xFF0C0036);
  static const Color darkError = Color(0xFFBA1B1B);
  static const Color darkOnError = Color(0xFFFFFFFF);
  static const Color darkSurface = Color(0xFF1A1C2D);
  static const Color darkOnSurface = Color(0xFFFCFCFF);
  static const Color darkOutline = Color(0xFF1565C0);
  static const Color darkOutlineVariant = Color.fromARGB(255, 4, 88, 243);
  static const Color darkSurfaceContainerHigh = Color(0xFF041A5B);
  static const Color darkSurfaceContainer = Color(0xFF42A5F5);

  // Font Family
  static const String defaultFontFamilyName = 'poppins';
}

const lightColorScheme = ColorScheme(
  brightness: Brightness.light,
  primary: AppTheme.lightPrimary,
  onPrimary: AppTheme.lightOnPrimary,
  secondary: AppTheme.lightSecondary,
  onSecondary: AppTheme.lightOnSecondary,
  tertiary: AppTheme.lightTertiary,
  onTertiary: AppTheme.lightOnTertiary,
  error: AppTheme.lightError,
  onError: AppTheme.lightOnError,
  surface: AppTheme.lightSurface,
  onSurface: AppTheme.lightOnSurface,
  outline: AppTheme.lightOutline,
  outlineVariant: AppTheme.lightOutlineVariant,
  surfaceContainerHigh: AppTheme.lightSurfaceContainerHigh,
  surfaceContainer: AppTheme.lightSurfaceContainer,
  onPrimaryContainer: AppTheme.lightPrimary,
  shadow: AppTheme.lightPrimary,
  tertiaryContainer: AppTheme.lightPrimary,
);

const darkColorScheme = ColorScheme(
  brightness: Brightness.dark,
  primary: AppTheme.darkPrimary,
  onPrimary: AppTheme.darkOnPrimary,
  secondary: AppTheme.darkSecondary,
  onSecondary: AppTheme.darkOnSecondary,
  tertiary: AppTheme.darkTertiary,
  onTertiary: AppTheme.darkOnTertiary,
  error: AppTheme.darkError,
  onError: AppTheme.darkOnError,
  surface: AppTheme.darkSurface,
  onSurface: AppTheme.darkOnSurface,
  outline: AppTheme.darkOutline,
  outlineVariant: AppTheme.darkOutlineVariant,
  surfaceContainerHigh: AppTheme.darkSurfaceContainerHigh,
  surfaceContainer: AppTheme.darkSurfaceContainer,
  onPrimaryContainer: AppTheme.darkPrimary,
  shadow: AppTheme.darkPrimary,
  tertiaryContainer: AppTheme.darkPrimary,
);
