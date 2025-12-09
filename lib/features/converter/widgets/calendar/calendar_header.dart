import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/constants/app_theme.dart';

/// Calendar header with navigation and view mode switcher.
class CalendarHeader extends StatelessWidget {
  /// Current date being displayed
  final DateTime currentDate;

  /// Current view mode (day, week, month)
  final CalendarViewMode viewMode;

  /// Callback when view mode changes
  final ValueChanged<CalendarViewMode> onViewModeChanged;

  /// Callback when navigating to previous period
  final VoidCallback onPrevious;

  /// Callback when navigating to next period
  final VoidCallback onNext;

  /// Callback when "Today" button is pressed
  final VoidCallback onToday;

  const CalendarHeader({
    super.key,
    required this.currentDate,
    required this.viewMode,
    required this.onViewModeChanged,
    required this.onPrevious,
    required this.onNext,
    required this.onToday,
  });

  String _getHeaderText() {
    switch (viewMode) {
      case CalendarViewMode.month:
        return DateFormat('MMMM yyyy').format(currentDate);
      case CalendarViewMode.week:
        final firstDay = _getFirstDayOfWeek(currentDate);
        final lastDay = firstDay.add(const Duration(days: 6));
        if (firstDay.month == lastDay.month) {
          return DateFormat('MMMM yyyy').format(currentDate);
        } else {
          return '${DateFormat('MMM').format(firstDay)} - ${DateFormat('MMM yyyy').format(lastDay)}';
        }
      case CalendarViewMode.day:
        return DateFormat('EEEE, MMMM d, yyyy').format(currentDate);
    }
  }

  DateTime _getFirstDayOfWeek(DateTime date) {
    final daysToSubtract = date.weekday - 1;
    return DateTime(date.year, date.month, date.day - daysToSubtract);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(
          color: colorScheme.outline.withValues(alpha: 0.1),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          // Title and navigation
          Row(
            children: [
              // Title
              Expanded(
                child: Text(
                  _getHeaderText(),
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: colorScheme.onSurface,
                    fontFamily: AppTheme.defaultFontFamilyName,
                    letterSpacing: -0.5,
                  ),
                ),
              ),

              // Today button
              Container(
                decoration: BoxDecoration(
                  color: colorScheme.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                  border: Border.all(
                    color: colorScheme.primary.withValues(alpha: 0.3),
                    width: 1,
                  ),
                ),
                child: TextButton(
                  onPressed: onToday,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppTheme.spacingMd,
                      vertical: AppTheme.spacingSm,
                    ),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    'Today',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: colorScheme.primary,
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                ),
              ),

              const SizedBox(width: AppTheme.spacingSm),

              // Navigation buttons
              _buildNavButton(
                context,
                icon: Icons.chevron_left_rounded,
                onPressed: onPrevious,
              ),
              const SizedBox(width: AppTheme.spacingXs),
              _buildNavButton(
                context,
                icon: Icons.chevron_right_rounded,
                onPressed: onNext,
              ),
            ],
          ),

          const SizedBox(height: AppTheme.spacingMd),

          // View mode switcher
          _buildViewModeSwitcher(context, colorScheme),
        ],
      ),
    );
  }

  Widget _buildNavButton(
    BuildContext context, {
    required IconData icon,
    required VoidCallback onPressed,
  }) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: colorScheme.outline.withValues(alpha: 0.2),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: IconButton(
        icon: Icon(icon, size: 22),
        onPressed: onPressed,
        padding: EdgeInsets.zero,
        color: colorScheme.onSurface,
        hoverColor: colorScheme.primary.withValues(alpha: 0.1),
      ),
    );
  }

  Widget _buildViewModeSwitcher(BuildContext context, ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: colorScheme.outline.withValues(alpha: 0.2),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildModeButton(
            context,
            label: 'Day',
            mode: CalendarViewMode.day,
            colorScheme: colorScheme,
          ),
          const SizedBox(width: 6),
          _buildModeButton(
            context,
            label: 'Week',
            mode: CalendarViewMode.week,
            colorScheme: colorScheme,
          ),
          const SizedBox(width: 6),
          _buildModeButton(
            context,
            label: 'Month',
            mode: CalendarViewMode.month,
            colorScheme: colorScheme,
          ),
        ],
      ),
    );
  }

  Widget _buildModeButton(
    BuildContext context, {
    required String label,
    required CalendarViewMode mode,
    required ColorScheme colorScheme,
  }) {
    final isSelected = viewMode == mode;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: () => onViewModeChanged(mode),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeInOut,
          padding: const EdgeInsets.symmetric(
            horizontal: 20,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            gradient: isSelected
                ? LinearGradient(
                  colors: [
                    colorScheme.primary,
                    colorScheme.primary.withValues(alpha: 0.85),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
                : null,
            color: isSelected ? null : Colors.transparent,
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            boxShadow:
                isSelected
                    ? [
                      BoxShadow(
                        color: colorScheme.primary.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                    : null,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
              color:
                  isSelected
                      ? Colors.white
                      : colorScheme.onSurface.withValues(alpha: 0.7),
              fontFamily: AppTheme.defaultFontFamilyName,
              letterSpacing: 0.3,
            ),
          ),
        ),
      ),
    );
  }
}

/// Enum for calendar view modes
enum CalendarViewMode { day, week, month }
