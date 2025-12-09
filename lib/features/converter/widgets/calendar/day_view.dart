import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/utils/calendar_utils.dart';

/// Day view showing a single day's events in a timeline.
class DayView extends StatefulWidget {
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
  State<DayView> createState() => _DayViewState();
}

class _DayViewState extends State<DayView> {
  late final ScrollController _scrollController;
  final double _hourHeight = 25.0; // Increased to enable scrolling
  bool _showUpIndicator = false;
  bool _showDownIndicator = false;

  @override
  void initState() {
    super.initState();
    // Scroll to 12:00 by default (User preference)
    _scrollController = ScrollController(initialScrollOffset: 12 * _hourHeight);

    // Listen to scroll to update indicators
    _scrollController.addListener(_updateIndicators);

    // Initial check after layout
    WidgetsBinding.instance.addPostFrameCallback((_) => _updateIndicators());
  }

  @override
  void dispose() {
    _scrollController.removeListener(_updateIndicators);
    _scrollController.dispose();
    super.dispose();
  }

  void _updateIndicators() {
    if (!mounted) return;

    final offset = _scrollController.offset;
    final viewportHeight = _scrollController.position.viewportDimension;

    // If viewport is not ready (e.g. 0), skip
    if (viewportHeight <= 0) return;

    final topHour = offset / _hourHeight;
    final bottomHour = (offset + viewportHeight) / _hourHeight;

    final dayEvents = CalendarUtils.getEventsForDate(
      widget.events,
      widget.displayDay,
    );

    bool showUp = false;
    bool showDown = false;

    for (final event in dayEvents) {
      final startHour =
          event.startDateTime.hour + event.startDateTime.minute / 60.0;
      final endHour =
          event.endDateTime.hour +
          event.endDateTime.minute / 60.0; // Approximate

      // Check if event is completely above the visible area
      // (Using endHour < topHour + 0.5 to be a bit lenient)
      if (endHour < topHour + 0.5) {
        showUp = true;
      }

      // Check if event is starting below visible area
      if (startHour > bottomHour - 0.5) {
        showDown = true;
      }
    }

    if (showUp != _showUpIndicator || showDown != _showDownIndicator) {
      setState(() {
        _showUpIndicator = showUp;
        _showDownIndicator = showDown;
      });
    }
  }

  void _scrollToTop() {
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  void _scrollToBottom() {
    _scrollController.animateTo(
      _scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  Widget _buildIndicator(BuildContext context, {required bool isUp}) {
    final colorScheme = Theme.of(context).colorScheme;
    return Positioned(
      top: isUp ? 10 : null,
      bottom: isUp ? null : 10,
      left: 0,
      right: 0,
      child: Center(
        child: InkWell(
          onTap: isUp ? _scrollToTop : _scrollToBottom,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: colorScheme.secondaryContainer.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isUp
                      ? Icons.arrow_upward_rounded
                      : Icons.arrow_downward_rounded,
                  size: 14,
                  color: colorScheme.onSecondaryContainer,
                ),
                const SizedBox(width: 4),
                Text(
                  isUp ? 'Earlier' : 'Later',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: colorScheme.onSecondaryContainer,
                    fontFamily: AppTheme.defaultFontFamilyName,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final dayEvents = CalendarUtils.getEventsForDate(
      widget.events,
      widget.displayDay,
    );
    final sortedEvents = CalendarUtils.sortEventsByTime(dayEvents);

    return SizedBox(
      height: 280,
      child: Stack(
        children: [
          SingleChildScrollView(
            controller: _scrollController,
            child: _buildTimeline(
              context,
              sortedEvents,
              colorScheme,
              _hourHeight,
            ),
          ),
          if (_showUpIndicator) _buildIndicator(context, isUp: true),
          if (_showDownIndicator) _buildIndicator(context, isUp: false),
        ],
      ),
    );
  }

  Widget _buildTimeline(
    BuildContext context,
    List<CalendarEvent> dayEvents,
    ColorScheme colorScheme,
    double hourHeight,
  ) {
    const hours = 24;
    final layouts = CalendarUtils.layoutOverlappingEvents(dayEvents);

    return SizedBox(
      height: hourHeight * hours,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Time labels
          SizedBox(
            width: 40,
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
                          fontSize: 10,
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
                        onTap: () => widget.onEventTapped?.call(event),
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
