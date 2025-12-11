import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';
import 'package:zadiag/features/converter/utils/calendar_utils.dart';

/// Week view showing events in a timeline grid.
class WeekView extends StatefulWidget {
  /// The week to display (any date in the week)
  final DateTime displayWeek;

  /// Events to display
  final List<CalendarEvent> events;

  /// Callback when an event is tapped
  final ValueChanged<CalendarEvent>? onEventTapped;

  const WeekView({
    super.key,
    required this.displayWeek,
    required this.events,
    this.onEventTapped,
  });

  @override
  State<WeekView> createState() => _WeekViewState();
}

class _WeekViewState extends State<WeekView> {
  late final ScrollController _scrollController;
  final double _hourHeight = 25.0; // Increased to enable scrolling
  bool _showUpIndicator = false;
  bool _showDownIndicator = false;

  @override
  void initState() {
    super.initState();
    // Scroll to 12:00 by default to focus on work hours
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

    // If viewport is not ready
    if (viewportHeight <= 0) return;

    final topHour = offset / _hourHeight;
    final bottomHour = (offset + viewportHeight) / _hourHeight;

    final weekEvents = CalendarUtils.getEventsForWeek(
      widget.events,
      widget.displayWeek,
    );

    bool showUp = false;
    bool showDown = false;

    for (final event in weekEvents) {
      final startHour =
          event.startDateTime.hour + event.startDateTime.minute / 60.0;
      final endHour = event.endDateTime.hour + event.endDateTime.minute / 60.0;

      // Check if event is hidden above
      if (endHour < topHour + 0.5) {
        showUp = true;
      }

      // Check if event is hidden below
      if (startHour > bottomHour - 0.5) {
        showDown = true;
      }

      if (showUp && showDown) break; // Optimization
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
            decoration: AppTheme.cardDecoration(
              colorScheme,
              borderRadius: 16,
              color: colorScheme.secondaryContainer.withValues(alpha: 0.9),
            ).copyWith(
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
    final weekDates = CalendarUtils.generateWeekDates(widget.displayWeek);

    return Column(
      children: [
        // Day headers
        _buildDayHeaders(context, weekDates, colorScheme),
        const SizedBox(height: AppTheme.spacingSm),

        // Timeline
        SizedBox(
          height: 230,
          child: Stack(
            children: [
              SingleChildScrollView(
                controller: _scrollController,
                child: _buildTimeline(
                  context,
                  weekDates,
                  colorScheme,
                  _hourHeight,
                ),
              ),
              if (_showUpIndicator) _buildIndicator(context, isUp: true),
              if (_showDownIndicator) _buildIndicator(context, isUp: false),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDayHeaders(
    BuildContext context,
    List<DateTime> weekDates,
    ColorScheme colorScheme,
  ) {
    return Row(
      children: [
        // Time column spacer
        const SizedBox(width: 35), // Reduced width
        // Day headers
        ...weekDates.map((date) {
          final isToday = CalendarUtils.isToday(date);

          return Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(
                vertical: 4,
              ), // Reduced padding
              decoration: BoxDecoration(
                color:
                    isToday
                        ? colorScheme.primary.withValues(alpha: 0.1)
                        : Colors.transparent,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Column(
                children: [
                  Text(
                    DateFormat('EEE').format(date),
                    style: TextStyle(
                      fontSize: 10, // Reduced font
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    date.day.toString(),
                    style: TextStyle(
                      fontSize: 12, // Reduced font
                      fontWeight: isToday ? FontWeight.w700 : FontWeight.w600,
                      color:
                          isToday ? colorScheme.primary : colorScheme.onSurface,
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }

  Widget _buildTimeline(
    BuildContext context,
    List<DateTime> weekDates,
    ColorScheme colorScheme,
    double hourHeight,
  ) {
    const hours = 24;

    return SizedBox(
      height: hourHeight * hours,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Time labels
          SizedBox(
            width: 35, // Reduced width
            child: Column(
              children: List.generate(hours, (hour) {
                return SizedBox(
                  height: hourHeight,
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: Text(
                      '${hour.toString().padLeft(2, '0')}:00',
                      style: TextStyle(
                        fontSize: 9, // Reduced font
                        color: colorScheme.onSurface.withValues(alpha: 0.5),
                        fontFamily: AppTheme.defaultFontFamilyName,
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),

          // Day columns
          ...weekDates.map((date) {
            return Expanded(
              child: _buildDayColumn(context, date, hourHeight, colorScheme),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildDayColumn(
    BuildContext context,
    DateTime date,
    double hourHeight,
    ColorScheme colorScheme,
  ) {
    final dayEvents = CalendarUtils.getEventsForDate(widget.events, date);
    final sortedEvents = CalendarUtils.sortEventsByTime(dayEvents);
    final layouts = CalendarUtils.layoutOverlappingEvents(sortedEvents);

    return Container(
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(
            color: colorScheme.outline.withValues(alpha: 0.2),
            width: 0.5,
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
                color: colorScheme.outline.withValues(alpha: 0.1),
              ),
            );
          }),

          // Events
          ...layouts.map((layout) {
            final event = layout['event'] as CalendarEvent;
            final position = CalendarUtils.calculateEventPosition(event);
            final column = layout['column'] as int;
            final totalColumns = layout['totalColumns'] as int;

            final widthFraction = 1.0 / totalColumns;
            final leftFraction = column / totalColumns;

            return Positioned(
              top: position['top']! * hourHeight * 24,
              height: position['height']! * hourHeight * 24,
              left: leftFraction * 100,
              right: (1 - leftFraction - widthFraction) * 100,
              child: GestureDetector(
                onTap: () => widget.onEventTapped?.call(event),
                child: Container(
                  margin: const EdgeInsets.only(
                    right: 1,
                    bottom: 1,
                  ), // Reduced margin
                  padding: const EdgeInsets.all(1), // Reduced padding
                  decoration: BoxDecoration(
                    color: colorScheme.primary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(2),
                    border: Border.all(
                      color: colorScheme.primary.withValues(alpha: 0.4),
                      width: 0.5,
                    ),
                  ),
                  child: OverflowBox(
                    maxHeight: double.infinity,
                    alignment: Alignment.topLeft,
                    child: Text(
                      event.title,
                      style: TextStyle(
                        fontSize: 7.5, // Reduced font
                        fontWeight: FontWeight.w600,
                        color: colorScheme.onSurface,
                        fontFamily: AppTheme.defaultFontFamilyName,
                        height: 1.0,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}
