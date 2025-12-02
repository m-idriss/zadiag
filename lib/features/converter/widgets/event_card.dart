import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import '../models/calendar_event.dart';

/// Widget for displaying a single calendar event as a card.
/// Features an elegant Apple-inspired design with slide-to-delete support.
class EventCard extends StatelessWidget {
  /// The calendar event to display
  final CalendarEvent event;

  /// Callback when the card is tapped
  final VoidCallback? onTap;

  /// Callback when delete is requested (via swipe or button)
  final VoidCallback? onDelete;

  /// Whether the event is selected
  final bool isSelected;

  const EventCard({
    super.key,
    required this.event,
    this.onTap,
    this.onDelete,
    this.isSelected = false,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    // Wrap with Dismissible for slide-to-delete functionality
    Widget card = _buildCard(context, colorScheme);

    if (onDelete != null) {
      card = Dismissible(
        key: Key(event.id),
        direction: DismissDirection.endToStart,
        onDismissed: (_) => onDelete?.call(),
        background: _buildDismissBackground(context, colorScheme),
        child: card,
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: AppTheme.spacingSm),
      child: card,
    );
  }

  /// Builds the dismiss background with delete icon
  Widget _buildDismissBackground(BuildContext context, ColorScheme colorScheme) {
    return Container(
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.only(right: AppTheme.spacingLg),
      decoration: BoxDecoration(
        color: colorScheme.error,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
      ),
      child: const Icon(
        Icons.delete_rounded,
        color: Colors.white,
        size: 24,
      ),
    );
  }

  /// Builds the main event card
  Widget _buildCard(BuildContext context, ColorScheme colorScheme) {
    final monthFormat = DateFormat('MMM');
    final dayFormat = DateFormat('d');
    final timeFormat = DateFormat.Hm();

    return Container(
      decoration: BoxDecoration(
        color: isSelected
            ? colorScheme.primary.withValues(alpha: 0.08)
            : colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(
          color: isSelected
              ? colorScheme.primary.withValues(alpha: 0.3)
              : colorScheme.outline.withValues(alpha: 0.5),
          width: 1,
        ),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          child: Padding(
            padding: const EdgeInsets.all(AppTheme.spacingMd),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Date badge (Month + Day) - Apple style
                _buildDateBadge(monthFormat, dayFormat, colorScheme),
                const SizedBox(width: AppTheme.spacingMd),
                // Title and location
                Expanded(
                  child: _buildEventDetails(colorScheme),
                ),
                const SizedBox(width: AppTheme.spacingSm),
                // Times column
                _buildTimesColumn(timeFormat, colorScheme),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Builds the date badge showing month and day number with Apple-style design.
  Widget _buildDateBadge(
      DateFormat monthFormat, DateFormat dayFormat, ColorScheme colorScheme) {
    return Container(
      width: 52,
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingSm,
        vertical: AppTheme.spacingSm,
      ),
      decoration: BoxDecoration(
        color: colorScheme.primary,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            monthFormat.format(event.startDateTime).toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.white,
              fontFamily: AppTheme.defaultFontFamilyName,
              letterSpacing: 0.5,
            ),
          ),
          Text(
            dayFormat.format(event.startDateTime),
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              fontFamily: AppTheme.defaultFontFamilyName,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  /// Builds the event title and location details.
  Widget _buildEventDetails(ColorScheme colorScheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Title
        Text(
          event.title,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: colorScheme.onSurface,
            fontFamily: AppTheme.defaultFontFamilyName,
            height: 1.3,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        // Location if available
        if (event.location != null && event.location!.isNotEmpty) ...[
          const SizedBox(height: AppTheme.spacingXs),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Icon(
                  Icons.location_on,
                  size: 14,
                  color: colorScheme.error,
                ),
              ),
              const SizedBox(width: 3),
              Expanded(
                child: Text(
                  event.location!,
                  style: TextStyle(
                    fontSize: 13,
                    color: colorScheme.onSurface.withValues(alpha: 0.6),
                    fontFamily: AppTheme.defaultFontFamilyName,
                    height: 1.3,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  /// Builds the start and end times column.
  Widget _buildTimesColumn(DateFormat timeFormat, ColorScheme colorScheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Start time
        Text(
          event.isAllDay ? 'All day' : timeFormat.format(event.startDateTime),
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: colorScheme.onSurface,
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
        ),
        // End time
        if (!event.isAllDay) ...[
          const SizedBox(height: 4),
          Text(
            timeFormat.format(event.endDateTime),
            style: TextStyle(
              fontSize: 13,
              color: colorScheme.onSurface.withValues(alpha: 0.5),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
        ],
      ],
    );
  }
}
