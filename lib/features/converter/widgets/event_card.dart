import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import '../models/calendar_event.dart';

/// Widget for displaying a single calendar event as a card.
/// Displays a compact view with date badge, title, location, and times.
class EventCard extends StatelessWidget {
  /// The calendar event to display
  final CalendarEvent event;

  /// Callback when the card is tapped
  final VoidCallback? onTap;

  /// Callback when delete is requested
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
    final monthFormat = DateFormat('MMM');
    final dayFormat = DateFormat('d');
    // Use locale-aware time format (respects user's 12h/24h preference)
    final timeFormat = DateFormat.Hm();

    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingSm),
      decoration: BoxDecoration(
        color: isSelected
            ? colorScheme.primary.withValues(alpha: 0.1)
            : colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
        border: Border.all(
          color: isSelected ? colorScheme.primary : colorScheme.outline,
          width: isSelected ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusLg),
          child: Padding(
            padding: const EdgeInsets.all(AppTheme.spacingSm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Date badge (Month + Day)
                _buildDateBadge(context, monthFormat, dayFormat, colorScheme),
                const SizedBox(width: AppTheme.spacingSm),
                // Title and location
                Expanded(
                  child: _buildEventDetails(context, colorScheme),
                ),
                const SizedBox(width: AppTheme.spacingSm),
                // Times column
                _buildTimesColumn(context, timeFormat, colorScheme),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Builds the date badge showing month and day number.
  Widget _buildDateBadge(BuildContext context, DateFormat monthFormat,
      DateFormat dayFormat, ColorScheme colorScheme) {
    return Container(
      width: 48,
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingXs,
        vertical: AppTheme.spacingXs,
      ),
      decoration: BoxDecoration(
        color: colorScheme.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            monthFormat.format(event.startDateTime).toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: colorScheme.primary,
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
          Text(
            dayFormat.format(event.startDateTime),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: colorScheme.primary,
              fontFamily: AppTheme.defaultFontFamilyName,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  /// Builds the event title and location details.
  Widget _buildEventDetails(BuildContext context, ColorScheme colorScheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Title
        Text(
          event.title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: colorScheme.onSurface,
            fontFamily: AppTheme.defaultFontFamilyName,
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
              Icon(
                Icons.location_on,
                size: 14,
                color: colorScheme.error,
              ),
              const SizedBox(width: 2),
              Expanded(
                child: Text(
                  event.location!,
                  style: TextStyle(
                    fontSize: 12,
                    color: colorScheme.onSurface.withValues(alpha: 0.6),
                    fontFamily: AppTheme.defaultFontFamilyName,
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
  Widget _buildTimesColumn(
      BuildContext context, DateFormat timeFormat, ColorScheme colorScheme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Start time
        Text(
          event.isAllDay ? 'All day' : timeFormat.format(event.startDateTime),
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: colorScheme.onSurface,
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
        ),
        // End time
        if (!event.isAllDay) ...[
          const SizedBox(height: 2),
          Text(
            timeFormat.format(event.endDateTime),
            style: TextStyle(
              fontSize: 12,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
        ],
        // Delete button with accessibility support
        if (onDelete != null)
          IconButton(
            onPressed: onDelete,
            icon: Icon(
              Icons.close_rounded,
              size: 18,
              color: colorScheme.error,
            ),
            padding: const EdgeInsets.only(top: AppTheme.spacingXs),
            constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
            tooltip: 'Remove event',
          ),
      ],
    );
  }
}
