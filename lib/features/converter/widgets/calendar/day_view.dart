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
    const hourHeight = 40.0; // Reduced from 80
    const hours = 24;
    final layouts = CalendarUtils.layoutOverlappingEvents(dayEvents);

    return SizedBox(
      height: hourHeight * hours,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Time labels
          SizedBox(
            width: 40, // Reduced from 60
            child: Column(
              children: List.generate(hours, (hour) {
                return SizedBox(
                  height: hourHeight,
                  child: Align(
                    alignment: Alignment.topRight,
                    child: Padding(
                      padding: const EdgeInsets.only(right: 6, top: 2),
                      child: Text(
                        '${hour.toString().padLeft(2, '0')}:00',
                        style: TextStyle(
                          fontSize: 10, // Reduced from 12
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
                    width: 1,
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
                      left: (leftFraction * 100).clamp(0, 95),
                      right: ((1 - leftFraction - widthFraction) * 100).clamp(
                        0,
                        95,
                      ),
                      child: GestureDetector(
                        onTap: () => onEventTapped?.call(event),
                        child: Container(
                          margin: const EdgeInsets.only(
                            left: 4,
                            right: 4,
                            bottom: 1,
                          ),
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: colorScheme.primary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                              color: colorScheme.primary.withValues(alpha: 0.4),
                              width: 1.0,
                            ),
                          ),
                          child: LayoutBuilder(
                            builder: (context, constraints) {
                              final availableHeight = constraints.maxHeight;
                              // Minimum height needed for title + padding is roughly 20-25px
                              // Logic: Title always priority. Time needs ~15px more. Location ~15px more.

                              final showTime =
                                  availableHeight > 35 && !event.isAllDay;
                              final showLocation =
                                  availableHeight > 50 &&
                                  event.location != null &&
                                  event.location!.isNotEmpty;

                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  // Title
                                  Flexible(
                                    child: Text(
                                      event.title,
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                        color: colorScheme.onSurface,
                                        fontFamily:
                                            AppTheme.defaultFontFamilyName,
                                        height: 1.1,
                                      ),
                                      maxLines: showTime ? 2 : 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),

                                  // Time
                                  if (showTime) ...[
                                    const SizedBox(height: 1),
                                    Text(
                                      '${DateFormat.Hm().format(event.startDateTime)} - ${DateFormat.Hm().format(event.endDateTime)}',
                                      style: TextStyle(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w500,
                                        color: colorScheme.onSurface.withValues(
                                          alpha: 0.7,
                                        ),
                                        fontFamily:
                                            AppTheme.defaultFontFamilyName,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],

                                  // Location
                                  if (showLocation) ...[
                                    const SizedBox(height: 1),
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.location_on_rounded,
                                          size: 9,
                                          color: colorScheme.error,
                                        ),
                                        const SizedBox(width: 2),
                                        Expanded(
                                          child: Text(
                                            event.location!,
                                            style: TextStyle(
                                              fontSize: 9,
                                              color: colorScheme.onSurface
                                                  .withValues(alpha: 0.6),
                                              fontFamily:
                                                  AppTheme
                                                      .defaultFontFamilyName,
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
                            },
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
