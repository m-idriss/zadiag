import 'package:flutter/material.dart';

class AppTheme {
  // Light Theme Colors - Modern, vibrant palette
  static const Color lightPrimary = Color(0xFF2563EB); // Vibrant blue
  static const Color lightOnPrimary = Color(0xFFFFFFFF);
  static const Color lightSecondary = Color(0xFF7C3AED); // Purple accent
  static const Color lightOnSecondary = Color(0xFFFFFFFF);
  static const Color lightTertiary = Color(0xFFF8FAFC); // Light background
  static const Color lightOnTertiary = Color(0xFF10B981); // Green accent
  static const Color lightError = Color(0xFFDC2626);
  static const Color lightOnError = Color(0xFFFFFFFF);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightOnSurface = Color(0xFF1E293B);
  static const Color lightOutline = Color(0xFFE2E8F0);
  static const Color lightOutlineVariant = Color(0xFF3B82F6);
  static const Color lightSurfaceContainerHigh = Color(0xFFF1F5F9);
  static const Color lightSurfaceContainer = Color(0xFFF8FAFC);
  static const Color lightMenuSurface = Color(0xFF0F172A);

  // Dark Theme Colors - Rich, immersive palette
  static const Color darkPrimary = Color(0xFF3B82F6); // Bright blue
  static const Color darkOnPrimary = Color(0xFFFFFFFF);
  static const Color darkSecondary = Color(0xFF8B5CF6); // Vibrant purple
  static const Color darkOnSecondary = Color(0xFFFFFFFF);
  static const Color darkTertiary = Color(0xFF1E293B); // Dark surface
  static const Color darkOnTertiary = Color(0xFF34D399); // Bright green
  static const Color darkError = Color(0xFFEF4444);
  static const Color darkOnError = Color(0xFFFFFFFF);
  static const Color darkSurface = Color(0xFF0F172A); // Deep dark
  static const Color darkOnSurface = Color(0xFFF8FAFC);
  static const Color darkOutline = Color(0xFF334155);
  static const Color darkOutlineVariant = Color(0xFF60A5FA);
  static const Color darkSurfaceContainerHigh = Color(0xFF1E293B);
  static const Color darkSurfaceContainer = Color(0xFF334155);
  static const Color darkMenuSurface = Color(0xFF0F172A);

  // Font Family
  static const String defaultFontFamilyName = 'poppins';

  // Spacing constants for consistent layout
  static const double spacingXs = 4.0;
  static const double spacingSm = 8.0;
  static const double spacingMd = 16.0;
  static const double spacingLg = 24.0;
  static const double spacingXl = 32.0;
  static const double spacingXxl = 48.0;

  // Border radius constants
  static const double radiusXs = 4.0;
  static const double radiusSm = 8.0;
  static const double radiusMd = 12.0;
  static const double radiusLg = 16.0;
  static const double radiusXl = 24.0;
  static const double radiusXxl = 32.0;
  static const double radiusFull = 9999.0;

  // Shadow definitions
  static List<BoxShadow> get cardShadow => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.05),
      blurRadius: 10,
      offset: const Offset(0, 4),
    ),
  ];

  static List<BoxShadow> get elevatedShadow => [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.1),
      blurRadius: 20,
      offset: const Offset(0, 8),
    ),
  ];

  // Private constructor to prevent instantiation
  const AppTheme._();

  /// Creates a heading text style (large, bold titles).
  static TextStyle headingStyle(Color color) => TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        fontFamily: defaultFontFamilyName,
        color: color,
        letterSpacing: -0.5,
      );

  /// Creates a title text style (section headers).
  static TextStyle titleStyle(Color color) => TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        fontFamily: defaultFontFamilyName,
        color: color,
      );

  /// Creates a body text style (regular content).
  static TextStyle bodyStyle(Color color, {double alpha = 1.0}) => TextStyle(
        fontSize: 14,
        fontFamily: defaultFontFamilyName,
        color: color.withValues(alpha: alpha),
        height: 1.5,
      );

  /// Creates a label text style (small, secondary text).
  static TextStyle labelStyle(Color color, {double alpha = 0.6}) => TextStyle(
        fontSize: 12,
        fontFamily: defaultFontFamilyName,
        color: color.withValues(alpha: alpha),
      );

  /// Creates a button text style.
  static TextStyle buttonStyle({Color color = Colors.white}) => TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        fontFamily: defaultFontFamilyName,
        color: color,
        letterSpacing: 0.5,
      );

  /// Creates a large button text style.
  static TextStyle buttonStyleLarge({Color color = Colors.white}) => TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w700,
        fontFamily: defaultFontFamilyName,
        color: color,
      );
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
  surfaceDim: AppTheme.lightMenuSurface,
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
  surfaceDim: AppTheme.darkMenuSurface,
);
