import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/utils/calendar_utils.dart';

/// Day view showing a single day's events in a timeline.
class DayView extends StatelessWidget {
  /// The day to display
  final DateTime displayDay;

  /// Events to display
  final List<CalendarEvent> events;

  /// Callback when an event is tapped
  final ValueChanged<CalendarEvent>? onEventTapped;

  const DayView({
    super.key,
    required this.displayDay,
    required this.events,
    this.onEventTapped,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final dayEvents = CalendarUtils.getEventsForDate(events, displayDay);
    final sortedEvents = CalendarUtils.sortEventsByTime(dayEvents);
    final isToday = CalendarUtils.isToday(displayDay);

    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        border: Border.all(
          color: colorScheme.outline.withValues(alpha: 0.1),
          width: 1,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        child: SizedBox(
          height: 600,
          child: SingleChildScrollView(
            child: _buildTimeline(context, sortedEvents, colorScheme, isToday),
          ),
        ),
      ),
    );
  }

  Widget _buildTimeline(
    BuildContext context,
    List<CalendarEvent> dayEvents,
    ColorScheme colorScheme,
    bool isToday,
  ) {
    const hourHeight = 80.0;
    const hours = 24;
    final layouts = CalendarUtils.layoutOverlappingEvents(dayEvents);
    
    // Calculate current time position for "now" indicator
    final now = DateTime.now();
    final currentTimePosition = isToday
        ? (now.hour * 60 + now.minute) / (24 * 60)
        : null;

    return SizedBox(
      height: hourHeight * hours,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Time labels
          SizedBox(
            width: 60,
            child: Column(
              children: List.generate(hours, (hour) {
                final isCurrentHour = isToday && hour == now.hour;
                return SizedBox(
                  height: hourHeight,
                  child: Align(
                    alignment: Alignment.topRight,
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Text(
                        '${hour.toString().padLeft(2, '0')}:00',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isCurrentHour ? FontWeight.w700 : FontWeight.w500,
                          color: isCurrentHour
                              ? colorScheme.primary
                              : colorScheme.onSurface.withValues(alpha: 0.5),
                          fontFamily: AppTheme.defaultFontFamilyName,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),

          // Event timeline
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                border: Border(
                  left: BorderSide(
                    color: colorScheme.outline.withValues(alpha: 0.25),
                    width: 2,
                  ),
                ),
              ),
              child: Stack(
                children: [
                  // Hour dividers
                  ...List.generate(24, (hour) {
                    return Positioned(
                      top: hour * hourHeight,
                      left: 0,
                      right: 0,
                      child: Container(
                        height: 1,
                        color: colorScheme.outline.withValues(alpha: 0.15),
                      ),
                    );
                  }),

                  // Events
                  ...layouts.map((layout) {
                    final event = layout['event'] as CalendarEvent;
                    final position = CalendarUtils.calculateEventPosition(
                      event,
                    );
                    final column = layout['column'] as int;
                    final totalColumns = layout['totalColumns'] as int;

                    final widthFraction = 1.0 / totalColumns;
                    final leftFraction = column / totalColumns;

                    return Positioned(
                      top: position['top']! * hourHeight * 24,
                      height: position['height']! * hourHeight * 24,
                      left: (leftFraction * 100).clamp(0, 90),
                      right: ((1 - leftFraction - widthFraction) * 100).clamp(
                        0,
                        90,
                      ),
                      child: MouseRegion(
                        cursor: SystemMouseCursors.click,
                        child: GestureDetector(
                          onTap: () => onEventTapped?.call(event),
                          child: Container(
                            margin: const EdgeInsets.only(
                              left: 8,
                              right: 8,
                              bottom: 2,
                            ),
                            padding: const EdgeInsets.all(AppTheme.spacingSm),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  colorScheme.primary.withValues(alpha: 0.2),
                                  colorScheme.primary.withValues(alpha: 0.15),
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(
                                AppTheme.radiusMd,
                              ),
                              border: Border.all(
                                color: colorScheme.primary.withValues(alpha: 0.5),
                                width: 1.5,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: colorScheme.primary.withValues(alpha: 0.15),
                                  blurRadius: 4,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Title
                                Text(
                                  event.title,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: colorScheme.onSurface,
                                    fontFamily: AppTheme.defaultFontFamilyName,
                                    height: 1.3,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),

                                const SizedBox(height: 4),

                                // Time
                                if (!event.isAllDay)
                                  Text(
                                    '${DateFormat.Hm().format(event.startDateTime)} - ${DateFormat.Hm().format(event.endDateTime)}',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                      color: colorScheme.onSurface.withValues(
                                        alpha: 0.7,
                                      ),
                                      fontFamily: AppTheme.defaultFontFamilyName,
                                    ),
                                  ),

                                // Location
                                if (event.location != null &&
                                    event.location!.isNotEmpty) ...[
                                  const SizedBox(height: 2),
                                  Row(
                                    children: [
                                      Icon(
                                        Icons.location_on_rounded,
                                        size: 11,
                                        color: colorScheme.error,
                                      ),
                                      const SizedBox(width: 2),
                                      Expanded(
                                        child: Text(
                                          event.location!,
                                          style: TextStyle(
                                            fontSize: 10,
                                            color: colorScheme.onSurface
                                                .withValues(alpha: 0.6),
                                            fontFamily:
                                                AppTheme.defaultFontFamilyName,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  }),

                  // Current time indicator (only show if today)
                  if (currentTimePosition != null)
                    Positioned(
                      top: currentTimePosition * hourHeight * 24,
                      left: 0,
                      right: 0,
                      child: Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: colorScheme.error,
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: colorScheme.error.withValues(alpha: 0.4),
                                  blurRadius: 4,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                          ),
                          Expanded(
                            child: Container(
                              height: 2,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    colorScheme.error,
                                    colorScheme.error.withValues(alpha: 0.3),
                                    Colors.transparent,
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
