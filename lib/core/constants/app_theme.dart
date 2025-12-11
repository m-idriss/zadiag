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

  static List<Shadow> get textShadow => [
    Shadow(
      color: Colors.black.withValues(alpha: 0.2),
      offset: const Offset(0, 2),
      blurRadius: 4,
    ),
  ];

  // Centralized Decoration Factories
  /// Creates a standard card decoration with consistent styling
  static BoxDecoration cardDecoration(
    ColorScheme colorScheme, {
    double borderRadius = radiusMd,
    Color? color,
    Color? borderColor,
    double borderWidth = 0,
  }) {
    return BoxDecoration(
      color: color ?? colorScheme.surfaceContainerHigh,
      borderRadius: BorderRadius.circular(borderRadius),
      border: borderWidth > 0
          ? Border.all(
              color: borderColor ?? Colors.transparent,
              width: borderWidth,
            )
          : null,
    );
  }

  /// Creates an icon container decoration with consistent styling
  static BoxDecoration iconContainerDecoration(
    ColorScheme colorScheme, {
    double borderRadius = radiusMd,
    Color? color,
    bool useGradient = false,
  }) {
    return BoxDecoration(
      gradient: useGradient
          ? LinearGradient(
              colors: [colorScheme.primary, colorScheme.secondary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            )
          : null,
      color: useGradient ? null : (color ?? colorScheme.primary.withValues(alpha: 0.1)),
      shape: borderRadius == radiusFull ? BoxShape.circle : BoxShape.rectangle,
      borderRadius: borderRadius == radiusFull ? null : BorderRadius.circular(borderRadius),
    );
  }

  /// Creates a glass/elevated container decoration with shadow
  static BoxDecoration glassDecoration(
    ColorScheme colorScheme, {
    double borderRadius = radiusXl,
    Color? color,
    Color? borderColor,
    double borderWidth = 1,
    double borderAlpha = 0.5,
    bool isDarkMode = false,
  }) {
    return BoxDecoration(
      color: color ?? colorScheme.surface,
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(
        color: borderColor ?? colorScheme.outline.withValues(alpha: borderAlpha),
        width: borderWidth,
      ),
      boxShadow: [
        BoxShadow(
          color: colorScheme.shadow.withValues(alpha: isDarkMode ? 0.3 : 0.15),
          offset: const Offset(0, 4),
          blurRadius: 20,
        ),
      ],
    );
  }

  /// Creates a theme option card decoration
  static BoxDecoration themeOptionDecoration(
    ColorScheme colorScheme, {
    required bool isSelected,
    double borderRadius = radiusMd,
  }) {
    return BoxDecoration(
      gradient: isSelected
          ? LinearGradient(
              colors: [colorScheme.primary, colorScheme.secondary],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            )
          : null,
      color: isSelected ? null : colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(
        color: isSelected
            ? colorScheme.primary.withValues(alpha: 0.3)
            : Colors.transparent,
        width: 2,
      ),
      boxShadow: isSelected
          ? [
              BoxShadow(
                color: colorScheme.primary.withValues(alpha: 0.3),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ]
          : null,
    );
  }

  /// Creates a button decoration with gradient
  static BoxDecoration buttonDecoration(
    ColorScheme colorScheme, {
    double borderRadius = radiusLg,
  }) {
    return BoxDecoration(
      borderRadius: BorderRadius.circular(borderRadius),
      gradient: LinearGradient(
        colors: [colorScheme.primary, colorScheme.secondary],
      ),
      boxShadow: [
        BoxShadow(
          color: colorScheme.primary.withValues(alpha: 0.3),
          blurRadius: 12,
          offset: const Offset(0, 6),
        ),
      ],
    );
  }

  /// Creates an avatar decoration with gradient
  static BoxDecoration avatarDecoration(
    ColorScheme colorScheme, {
    double borderRadius = radiusFull,
  }) {
    return BoxDecoration(
      gradient: LinearGradient(
        colors: [colorScheme.primary, colorScheme.secondary],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      shape: borderRadius == radiusFull ? BoxShape.circle : BoxShape.rectangle,
      borderRadius: borderRadius == radiusFull ? null : BorderRadius.circular(borderRadius),
      boxShadow: [
        BoxShadow(
          color: colorScheme.primary.withValues(alpha: 0.3),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  /// Creates a date badge decoration
  static BoxDecoration dateBadgeDecoration(
    ColorScheme colorScheme, {
    double borderRadius = radiusMd,
  }) {
    return BoxDecoration(
      color: colorScheme.surface,
      borderRadius: BorderRadius.circular(borderRadius),
    );
  }

  /// Creates an event card decoration
  static BoxDecoration eventCardDecoration(
    ColorScheme colorScheme, {
    double borderRadius = radiusMd,
    double alpha = 0.15,
  }) {
    return BoxDecoration(
      color: colorScheme.primary.withValues(alpha: alpha),
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(
        color: colorScheme.primary.withValues(alpha: alpha * 2.5),
        width: 1.0,
      ),
    );
  }

  // Private constructor to prevent instantiation
  const AppTheme._();

  static ThemeData getLight({double textScaleFactor = 1.0}) {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: lightColorScheme,
      fontFamily: defaultFontFamilyName,
      scaffoldBackgroundColor: lightTertiary,
      /*
      // TODO: Fix CardTheme type error
      cardTheme: CardTheme(
        color: lightSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          side: const BorderSide(color: lightOutline, width: 1),
        ),
        margin: EdgeInsets.zero,
      ),
      */
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: lightPrimary,
          foregroundColor: lightOnPrimary,
          elevation: 0,
          textStyle: TextStyle(
            fontSize: 16 * textScaleFactor,
            fontWeight: FontWeight.w600,
            fontFamily: defaultFontFamilyName,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: spacingLg,
            vertical: spacingMd,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusLg),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: lightPrimary,
          side: const BorderSide(color: lightOutlineVariant),
          textStyle: TextStyle(
            fontSize: 14 * textScaleFactor,
            fontWeight: FontWeight.w600,
            fontFamily: defaultFontFamilyName,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: spacingMd,
            vertical: spacingMd,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: lightSurface,
        contentPadding: const EdgeInsets.all(spacingMd),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: lightOutline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: lightOutline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: lightPrimary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: lightError),
        ),
      ),
      textTheme: _textTheme(lightOnSurface, textScaleFactor),
    );
  }

  static ThemeData getDark({double textScaleFactor = 1.0}) {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: darkColorScheme,
      fontFamily: defaultFontFamilyName,
      scaffoldBackgroundColor: darkTertiary,
      /*
      // TODO: Fix CardTheme type error
      cardTheme: CardTheme(
        color: darkSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          side: const BorderSide(color: darkOutline, width: 1),
        ),
        margin: EdgeInsets.zero,
      ),
      */
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: darkPrimary,
          foregroundColor: darkOnPrimary,
          elevation: 0,
          textStyle: TextStyle(
            fontSize: 16 * textScaleFactor,
            fontWeight: FontWeight.w600,
            fontFamily: defaultFontFamilyName,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: spacingLg,
            vertical: spacingMd,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusLg),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: darkPrimary,
          side: const BorderSide(color: darkOutlineVariant),
          textStyle: TextStyle(
            fontSize: 14 * textScaleFactor,
            fontWeight: FontWeight.w600,
            fontFamily: defaultFontFamilyName,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: spacingMd,
            vertical: spacingMd,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(radiusMd),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: darkSurface,
        contentPadding: const EdgeInsets.all(spacingMd),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: darkOutline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: darkOutline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: darkPrimary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMd),
          borderSide: const BorderSide(color: darkError),
        ),
      ),
      textTheme: _textTheme(darkOnSurface, textScaleFactor),
    );
  }

  static TextTheme _textTheme(Color color, [double scaleFactor = 1.0]) {
    return TextTheme(
      displayLarge: TextStyle(
        fontSize: 57 * scaleFactor,
        fontWeight: FontWeight.w400,
        fontFamily: defaultFontFamilyName,
        color: color,
      ),
      displayMedium: TextStyle(
        fontSize: 45 * scaleFactor,
        fontWeight: FontWeight.w400,
        fontFamily: defaultFontFamilyName,
        color: color,
      ),
      displaySmall: TextStyle(
        fontSize: 36 * scaleFactor,
        fontWeight: FontWeight.w400,
        fontFamily: defaultFontFamilyName,
        color: color,
      ),
      headlineLarge: TextStyle(
        fontSize: 32 * scaleFactor,
        fontWeight: FontWeight.w400,
        fontFamily: defaultFontFamilyName,
        color: color,
      ),
      headlineMedium: TextStyle(
        fontSize: 28 * scaleFactor,
        fontWeight: FontWeight.w400,
        fontFamily: defaultFontFamilyName,
        color: color,
      ),
      headlineSmall: TextStyle(
        fontSize: 24 * scaleFactor,
        fontWeight: FontWeight.w400,
        fontFamily: defaultFontFamilyName,
        color: color,
      ),
      titleLarge: TextStyle(
        fontSize: 22 * scaleFactor,
        fontWeight: FontWeight.w500,
        fontFamily: defaultFontFamilyName,
        color: color,
      ),
      titleMedium: TextStyle(
        fontSize: 16 * scaleFactor,
        fontWeight: FontWeight.w500,
        fontFamily: defaultFontFamilyName,
        color: color,
        letterSpacing: 0.15,
      ),
      titleSmall: TextStyle(
        fontSize: 14 * scaleFactor,
        fontWeight: FontWeight.w500,
        fontFamily: defaultFontFamilyName,
        color: color,
        letterSpacing: 0.1,
      ),
      bodyLarge: TextStyle(
        fontSize: 16 * scaleFactor,
        fontWeight: FontWeight.w400,
        fontFamily: defaultFontFamilyName,
        color: color,
        letterSpacing: 0.5,
      ),
      bodyMedium: TextStyle(
        fontSize: 14 * scaleFactor,
        fontWeight: FontWeight.w400,
        fontFamily: defaultFontFamilyName,
        color: color,
        letterSpacing: 0.25,
      ),
      bodySmall: TextStyle(
        fontSize: 12 * scaleFactor,
        fontWeight: FontWeight.w400,
        fontFamily: defaultFontFamilyName,
        color: color.withValues(alpha: 0.7),
        letterSpacing: 0.4,
      ),
      labelLarge: TextStyle(
        fontSize: 14 * scaleFactor,
        fontWeight: FontWeight.w500,
        fontFamily: defaultFontFamilyName,
        color: color,
        letterSpacing: 0.1,
      ),
      labelMedium: TextStyle(
        fontSize: 12 * scaleFactor,
        fontWeight: FontWeight.w500,
        fontFamily: defaultFontFamilyName,
        color: color,
        letterSpacing: 0.5,
      ),
      labelSmall: TextStyle(
        fontSize: 11 * scaleFactor,
        fontWeight: FontWeight.w500,
        fontFamily: defaultFontFamilyName,
        color: color,
        letterSpacing: 0.5,
      ),
    );
  }

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
