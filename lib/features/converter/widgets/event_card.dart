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
  Widget _buildDismissBackground(
    BuildContext context,
    ColorScheme colorScheme,
  ) {
    return Container(
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.only(right: AppTheme.spacingLg),
      decoration: BoxDecoration(
        color: colorScheme.error,
        borderRadius: BorderRadius.circular(AppTheme.radiusLg),
      ),
      child: const Icon(Icons.delete_rounded, color: Colors.white, size: 24),
    );
  }

  /// Builds the main event card
  Widget _buildCard(BuildContext context, ColorScheme colorScheme) {
    final monthFormat = DateFormat('MMM');
    final dayFormat = DateFormat('d');
    final timeFormat = DateFormat.Hm();

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: Colors.transparent,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          child: Padding(
            padding: const EdgeInsets.all(AppTheme.spacingSm),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Date badge
                _buildDateBadge(monthFormat, dayFormat, colorScheme),
                const SizedBox(width: AppTheme.spacingMd),
                // Title and location
                Expanded(child: _buildEventDetails(colorScheme)),
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

  /// Builds the date badge showing month and day number.
  Widget _buildDateBadge(
    DateFormat monthFormat,
    DateFormat dayFormat,
    ColorScheme colorScheme,
  ) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            dayFormat.format(event.startDateTime),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: colorScheme.primary,
              fontFamily: AppTheme.defaultFontFamilyName,
              height: 1.0,
            ),
          ),
          Text(
            monthFormat.format(event.startDateTime).toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
              fontFamily: AppTheme.defaultFontFamilyName,
              letterSpacing: 0.5,
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
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: colorScheme.onSurface,
            fontFamily: AppTheme.defaultFontFamilyName,
            height: 1.3,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        // Location if available
        if (event.location != null && event.location!.isNotEmpty) ...[
          const SizedBox(height: 2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Icon(
                Icons.location_on_rounded,
                size: 12,
                color: colorScheme.error,
              ),
              const SizedBox(width: 2),
              Expanded(
                child: Text(
                  event.location!,
                  style: TextStyle(
                    fontSize: 12,
                    color: colorScheme.onSurface.withValues(alpha: 0.5),
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                  maxLines: 1,
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
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: colorScheme.onSurface.withValues(alpha: 0.6),
            fontFamily: AppTheme.defaultFontFamilyName,
          ),
        ),
        // End time
        if (!event.isAllDay) ...[
          Text(
            timeFormat.format(event.endDateTime),
            style: TextStyle(
              fontSize: 12,
              color: colorScheme.onSurface.withValues(alpha: 0.4),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
        ],
      ],
    );
  }
}
