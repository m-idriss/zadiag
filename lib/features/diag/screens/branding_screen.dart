import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';

class BrandingScreen extends StatefulWidget {
  const BrandingScreen({super.key});

  @override
  State<BrandingScreen> createState() => _BrandingScreenState();
}

bool notificationsEnabled = true;

class _BrandingScreenState extends State<BrandingScreen> {
  final _formKey = GlobalKey<FormState>();

  int _eventsGenerated = 28453;
  int _imagesProcessed = 2112;
  int _hoursSaved = 198;
  int _workdaysSaved = 25;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        setState(() {
          _eventsGenerated = 28453;
          _imagesProcessed = 2112;
          _hoursSaved = 198;
          _workdaysSaved = 25;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final defaultColorScheme = Theme.of(context).colorScheme;

    final double spacingLg = AppTheme.spacingLg;
    final double spacingXl = AppTheme.spacingXl;
    final double radiusLg = AppTheme.radiusLg;

    return Scaffold(
      body: Container(
        decoration: _background(defaultColorScheme),
        child: SafeArea(
          child: Form(
            key: _formKey,
            child: ListView(
              padding: EdgeInsets.all(spacingLg),
              physics: const BouncingScrollPhysics(),
              children: [
                _header(context),
                SizedBox(height: spacingXl),
                _brandingCard(context, radiusLg),
                SizedBox(height: spacingXl),
                _buildStatsSection(context),
                SizedBox(height: spacingXl * 1.5),
               // _actionButton(context),
               // SizedBox(height: spacingLg),
              ],
            ),
          ),
        ),
      ),
    );
  }

  BoxDecoration _background(ColorScheme colorScheme) {
    return buildBackground(colorScheme);
  }

  Column _header(BuildContext context) {
    return buildHeader(
      context,
      trad(context)!.branding,
      trad(context)!.branding_subtitle,
    );
  }

  Widget _brandingCard(BuildContext context, double radiusLg) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(radiusLg),
      ),
      elevation: 4,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radiusLg),
        child: SizedBox(
          width: double.infinity,
          height: 240,
          child: SvgPicture.asset(
            'assets/images/converter.svg',
            fit: BoxFit.cover,
            semanticsLabel: 'Converter illustration',
            placeholderBuilder: (context) => Container(
              color: Theme.of(context).colorScheme.surface,
              child: const Center(child: CircularProgressIndicator()),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(Icons.bar_chart_rounded, color: Theme.of(context).colorScheme.primary, size: 28),
            SizedBox(width: AppTheme.spacingSm),
            Text(
              trad(context)!.powering_productivity,
              style: TextStyle(
                color: Theme.of(context).colorScheme.secondary,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        SizedBox(height: AppTheme.spacingMd),

        _buildStatLine(
          context,
          _eventsGenerated,
          trad(context)!.events_generated,
          _imagesProcessed,
          trad(context)!.images,
          Theme.of(context).colorScheme.secondary,
        ),
        SizedBox(height: AppTheme.spacingSm),

        _buildStatLine(
          context,
          _hoursSaved,
          trad(context)!.hours_saved,
          null,
          null,
          Theme.of(context).colorScheme.secondary,
        ),
        SizedBox(height: AppTheme.spacingSm),

        _buildStatLine(
          context,
          _workdaysSaved,
          trad(context)!.workdays_saved,
          null,
          null,
          Theme.of(context).colorScheme.secondary,
        ),
      ],
    );
  }

  Widget _buildStatLine(
      BuildContext context,
      int value1,
      String text1,
      int? value2,
      String? text2,
      Color accentColor,
      ) {
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          _buildAnimatedCounter(value1, accentColor),
          SizedBox(width: AppTheme.spacingSm / 2),
          Text(
            text1,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.85),
              fontSize: 18,
              fontWeight: FontWeight.w500,
            ),
          ),
          if (value2 != null) ...[
            SizedBox(width: AppTheme.spacingMd),
            _buildAnimatedCounter(value2, accentColor),
            SizedBox(width: AppTheme.spacingSm / 2),
            Text(
              text2!,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha:0.85),
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAnimatedCounter(int targetValue, Color accentColor) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: targetValue.toDouble()),
      duration: const Duration(seconds: 1),
      builder: (context, value, child) {
        final formatter = NumberFormat('#,###', 'fr_FR');
        return Text(
          formatter.format(value.toInt()),
          style: TextStyle(
            color: accentColor,
            fontSize: 20,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.5,
          ),
        );
      },
    );
  }

}