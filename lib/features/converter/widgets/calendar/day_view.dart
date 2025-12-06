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

    return SizedBox(
      height: 600,
      child: SingleChildScrollView(
        child: _buildTimeline(context, sortedEvents, colorScheme),
      ),
    );
  }

  Widget _buildTimeline(
    BuildContext context,
    List<CalendarEvent> dayEvents,
    ColorScheme colorScheme,
  ) {
    const hourHeight = 80.0;
    const hours = 24;
    final layouts = CalendarUtils.layoutOverlappingEvents(dayEvents);

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
                          fontWeight: FontWeight.w500,
                          color: colorScheme.onSurface.withValues(alpha: 0.5),
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
                    color: colorScheme.outline.withValues(alpha: 0.2),
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
                            color: colorScheme.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(
                              AppTheme.radiusSm,
                            ),
                            border: Border.all(
                              color: colorScheme.primary.withValues(alpha: 0.4),
                              width: 1.5,
                            ),
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
                    );
                  }),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
