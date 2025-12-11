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
        return DateFormat('EEE, MMM d, yyyy').format(currentDate);
    }
  }

  DateTime _getFirstDayOfWeek(DateTime date) {
    final daysToSubtract = date.weekday - 1;
    return DateTime(date.year, date.month, date.day - daysToSubtract);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        // Title and navigation
        Row(
          children: [
            // Title
            Expanded(
              child: Text(
                _getHeaderText(),
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: colorScheme.onSurface,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
              ),
            ),

            // Today button
            TextButton(
              onPressed: onToday,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppTheme.spacingMd,
                  vertical: AppTheme.spacingSm,
                ),
              ),
              child: Text(
                'Today',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: colorScheme.primary,
                  fontFamily: AppTheme.defaultFontFamilyName,
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
    );
  }

  Widget _buildNavButton(
    BuildContext context, {
    required IconData icon,
    required VoidCallback onPressed,
  }) {
    final colorScheme = Theme.of(context).colorScheme;

    return Container(
      width: 36,
      height: 36,
      decoration: AppTheme.cardDecoration(colorScheme, borderRadius: AppTheme.radiusSm),
      child: IconButton(
        icon: Icon(icon, size: 20),
        onPressed: onPressed,
        padding: EdgeInsets.zero,
        color: colorScheme.onSurface,
      ),
    );
  }

  Widget _buildViewModeSwitcher(BuildContext context, ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: AppTheme.cardDecoration(colorScheme, borderRadius: AppTheme.radiusSm),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildModeButton(
            context,
            label: 'Day',
            mode: CalendarViewMode.day,
            colorScheme: colorScheme,
          ),
          const SizedBox(width: 4),
          _buildModeButton(
            context,
            label: 'Week',
            mode: CalendarViewMode.week,
            colorScheme: colorScheme,
          ),
          const SizedBox(width: 4),
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

    return GestureDetector(
      onTap: () => onViewModeChanged(mode),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
          horizontal: AppTheme.spacingMd,
          vertical: AppTheme.spacingSm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? colorScheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(AppTheme.radiusXs),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color:
                isSelected
                    ? Colors.white
                    : colorScheme.onSurface.withValues(alpha: 0.7),
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
        ),
      ),
    );
  }
}

/// Enum for calendar view modes
enum CalendarViewMode { day, week, month }
