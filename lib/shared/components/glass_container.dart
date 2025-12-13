import 'package:flutter/material.dart';

class GlassContainer extends StatelessWidget {
  final Widget child;
  final double width;
  final double? height;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double borderRadius;
  final double blur;
  final double opacity;
  final Color? color;
  final BoxBorder? border;
  final List<BoxShadow>? boxShadow;

  const GlassContainer({
    super.key,
    required this.child,
    this.width = double.infinity,
    this.height,
    this.padding,
    this.margin,
    this.borderRadius = 8,
    this.blur = 10,
    this.opacity = 0.1,
    this.color,
    this.border,
    this.boxShadow,
  });

  @override
  Widget build(BuildContext context) {
    // Get theme-aware base color
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final themeSurface = Theme.of(context).colorScheme.surface;
    final themeOutline = Theme.of(context).colorScheme.outline;
    
    // Use theme surface color for flat design
    final baseColor = color ?? themeSurface;

    return Container(
      width: width,
      height: height,
      margin: margin,
      padding: padding ?? EdgeInsets.zero,
      decoration: BoxDecoration(
        color: baseColor,
        borderRadius: BorderRadius.circular(borderRadius),
        border:
            border ??
            Border.all(
              color: themeOutline,
              width: 1,
            ),
        boxShadow:
            boxShadow ??
            [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDarkMode ? 0.04 : 0.02),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
      ),
      child: child,
    );
  }
}
