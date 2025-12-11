import 'package:flutter/material.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';

/// Compact event cell for calendar views with glassmorphic styling.
class CalendarEventCell extends StatelessWidget {
  /// The event to display
  final CalendarEvent event;

  /// Whether to show time
  final bool showTime;

  /// Callback when tapped
  final VoidCallback? onTap;

  /// Width fraction (for overlapping events)
  final double widthFraction;

  /// Left offset fraction (for overlapping events)
  final double leftFraction;

  const CalendarEventCell({
    super.key,
    required this.event,
    this.showTime = true,
    this.onTap,
    this.widthFraction = 1.0,
    this.leftFraction = 0.0,
  });

  Color _getEventColor(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    // Use primary color for events, could be extended for categories
    return colorScheme.primary;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final eventColor = _getEventColor(context);

    return Positioned(
      left: leftFraction * 100,
      right: (1 - leftFraction - widthFraction) * 100,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(right: 2, bottom: 2),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          decoration: AppTheme.eventCardDecoration(
            colorScheme,
            borderRadius: 4,
            alpha: 0.15,
          ).copyWith(
            color: eventColor.withValues(alpha: 0.15),
            border: Border.all(
              color: eventColor.withValues(alpha: 0.4),
              width: 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Title
              Text(
                event.title,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface,
                  fontFamily: AppTheme.defaultFontFamilyName,
                  height: 1.2,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),

              // Time (if shown)
              if (showTime && !event.isAllDay) ...[
                const SizedBox(height: 1),
                Text(
                  _formatTime(),
                  style: TextStyle(
                    fontSize: 10,
                    color: colorScheme.onSurface.withValues(alpha: 0.6),
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _formatTime() {
    if (event.isAllDay) return 'All day';
    final start =
        '${event.startDateTime.hour.toString().padLeft(2, '0')}:${event.startDateTime.minute.toString().padLeft(2, '0')}';
    return start;
  }
}

/// Simple event indicator dot for month view.
class EventIndicatorDot extends StatelessWidget {
  /// Color of the dot
  final Color color;

  const EventIndicatorDot({super.key, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 5,
      height: 5,
      margin: const EdgeInsets.only(right: 2),
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}
