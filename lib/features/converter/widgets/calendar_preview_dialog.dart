import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/translate.dart';
import '../models/calendar_event.dart';

/// Enum representing the available calendar view types.
enum CalendarViewType { daily, weekly, monthly }

/// A dialog widget that displays calendar events in different view modes.
/// Supports daily, weekly, and monthly views with navigation controls.
class CalendarPreviewDialog extends StatefulWidget {
  /// The list of calendar events to display.
  final List<CalendarEvent> events;

  const CalendarPreviewDialog({super.key, required this.events});

  @override
  State<CalendarPreviewDialog> createState() => _CalendarPreviewDialogState();
}

class _CalendarPreviewDialogState extends State<CalendarPreviewDialog> {
  CalendarViewType _viewType = CalendarViewType.weekly;
  late DateTime _selectedDate;

  @override
  void initState() {
    super.initState();
    // Start with today or the first event's date
    _selectedDate = widget.events.isNotEmpty
        ? widget.events.first.startDateTime
        : DateTime.now();
  }

  /// Navigate to the previous period based on view type.
  void _previousPeriod() {
    setState(() {
      switch (_viewType) {
        case CalendarViewType.daily:
          _selectedDate = _selectedDate.subtract(const Duration(days: 1));
          break;
        case CalendarViewType.weekly:
          _selectedDate = _selectedDate.subtract(const Duration(days: 7));
          break;
        case CalendarViewType.monthly:
          _selectedDate = DateTime(
            _selectedDate.year,
            _selectedDate.month - 1,
            1,
          );
          break;
      }
    });
  }

  /// Navigate to the next period based on view type.
  void _nextPeriod() {
    setState(() {
      switch (_viewType) {
        case CalendarViewType.daily:
          _selectedDate = _selectedDate.add(const Duration(days: 1));
          break;
        case CalendarViewType.weekly:
          _selectedDate = _selectedDate.add(const Duration(days: 7));
          break;
        case CalendarViewType.monthly:
          _selectedDate = DateTime(
            _selectedDate.year,
            _selectedDate.month + 1,
            1,
          );
          break;
      }
    });
  }

  /// Navigate to today.
  void _goToToday() {
    setState(() {
      _selectedDate = DateTime.now();
    });
  }

  /// Get the period title based on view type.
  String _getPeriodTitle() {
    switch (_viewType) {
      case CalendarViewType.daily:
        return DateFormat.yMMMMEEEEd().format(_selectedDate);
      case CalendarViewType.weekly:
        final weekStart = _getWeekStart(_selectedDate);
        final weekEnd = weekStart.add(const Duration(days: 6));
        final startFormat = DateFormat.MMMd();
        final endFormat =
            weekStart.month == weekEnd.month
                ? DateFormat.d()
                : DateFormat.MMMd();
        return '${startFormat.format(weekStart)} - ${endFormat.format(weekEnd)}, ${weekEnd.year}';
      case CalendarViewType.monthly:
        return DateFormat.yMMMM().format(_selectedDate);
    }
  }

  /// Get the start of the week (Monday).
  DateTime _getWeekStart(DateTime date) {
    final daysFromMonday = date.weekday - 1;
    return DateTime(date.year, date.month, date.day - daysFromMonday);
  }

  /// Filter events for a specific day.
  List<CalendarEvent> _getEventsForDay(DateTime day) {
    return widget.events.where((event) {
      final eventDate = DateTime(
        event.startDateTime.year,
        event.startDateTime.month,
        event.startDateTime.day,
      );
      final targetDate = DateTime(day.year, day.month, day.day);
      return eventDate == targetDate;
    }).toList();
  }

  /// Get all events for the current week.
  Map<DateTime, List<CalendarEvent>> _getEventsForWeek() {
    final weekStart = _getWeekStart(_selectedDate);
    final Map<DateTime, List<CalendarEvent>> weekEvents = {};

    for (int i = 0; i < 7; i++) {
      final day = weekStart.add(Duration(days: i));
      final dayKey = DateTime(day.year, day.month, day.day);
      weekEvents[dayKey] = _getEventsForDay(day);
    }

    return weekEvents;
  }

  /// Get all events for the current month.
  Map<DateTime, List<CalendarEvent>> _getEventsForMonth() {
    final firstDayOfMonth = DateTime(_selectedDate.year, _selectedDate.month, 1);
    final lastDayOfMonth = DateTime(
      _selectedDate.year,
      _selectedDate.month + 1,
      0,
    );
    final Map<DateTime, List<CalendarEvent>> monthEvents = {};

    for (
      var day = firstDayOfMonth;
      day.isBefore(lastDayOfMonth.add(const Duration(days: 1)));
      day = day.add(const Duration(days: 1))
    ) {
      final dayKey = DateTime(day.year, day.month, day.day);
      final events = _getEventsForDay(day);
      if (events.isNotEmpty) {
        monthEvents[dayKey] = events;
      }
    }

    return monthEvents;
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Dialog(
      backgroundColor: colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppTheme.radiusXl),
      ),
      child: Container(
        width: MediaQuery.of(context).size.width * 0.9,
        constraints: BoxConstraints(
          maxWidth: 500,
          maxHeight: MediaQuery.of(context).size.height * 0.8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildHeader(context, colorScheme),
            _buildViewToggle(context, colorScheme),
            _buildNavigationBar(context, colorScheme),
            Flexible(child: _buildCalendarContent(context, colorScheme)),
            _buildFooter(context, colorScheme),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      decoration: BoxDecoration(
        color: colorScheme.primary.withValues(alpha: 0.1),
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(AppTheme.radiusXl),
          topRight: Radius.circular(AppTheme.radiusXl),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.calendar_month_rounded,
            color: colorScheme.primary,
            size: 24,
          ),
          const SizedBox(width: AppTheme.spacingSm),
          Expanded(
            child: Text(
              trad(context)!.calendar_preview,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: colorScheme.onSurface,
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
          ),
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: Icon(
              Icons.close_rounded,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildViewToggle(BuildContext context, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppTheme.spacingMd,
        vertical: AppTheme.spacingSm,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainerHigh,
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        ),
        padding: const EdgeInsets.all(4),
        child: Row(
          children: [
            _buildViewButton(
              context,
              colorScheme,
              CalendarViewType.daily,
              trad(context)!.daily_view,
            ),
            _buildViewButton(
              context,
              colorScheme,
              CalendarViewType.weekly,
              trad(context)!.weekly_view,
            ),
            _buildViewButton(
              context,
              colorScheme,
              CalendarViewType.monthly,
              trad(context)!.monthly_view,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildViewButton(
    BuildContext context,
    ColorScheme colorScheme,
    CalendarViewType type,
    String label,
  ) {
    final isSelected = _viewType == type;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _viewType = type),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingSm),
          decoration: BoxDecoration(
            color: isSelected ? colorScheme.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
              color: isSelected ? colorScheme.onPrimary : colorScheme.onSurface,
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavigationBar(BuildContext context, ColorScheme colorScheme) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppTheme.spacingMd),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: _previousPeriod,
            icon: Icon(
              Icons.chevron_left_rounded,
              color: colorScheme.primary,
            ),
          ),
          Expanded(
            child: GestureDetector(
              onTap: _goToToday,
              child: Text(
                _getPeriodTitle(),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: colorScheme.onSurface,
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
              ),
            ),
          ),
          IconButton(
            onPressed: _nextPeriod,
            icon: Icon(
              Icons.chevron_right_rounded,
              color: colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCalendarContent(BuildContext context, ColorScheme colorScheme) {
    switch (_viewType) {
      case CalendarViewType.daily:
        return _buildDailyView(context, colorScheme);
      case CalendarViewType.weekly:
        return _buildWeeklyView(context, colorScheme);
      case CalendarViewType.monthly:
        return _buildMonthlyView(context, colorScheme);
    }
  }

  Widget _buildDailyView(BuildContext context, ColorScheme colorScheme) {
    final events = _getEventsForDay(_selectedDate);

    if (events.isEmpty) {
      return _buildEmptyState(context, colorScheme);
    }

    return ListView.builder(
      shrinkWrap: true,
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      itemCount: events.length,
      itemBuilder: (context, index) {
        return _buildEventItem(context, colorScheme, events[index]);
      },
    );
  }

  Widget _buildWeeklyView(BuildContext context, ColorScheme colorScheme) {
    final weekEvents = _getEventsForWeek();
    final weekStart = _getWeekStart(_selectedDate);

    return ListView.builder(
      shrinkWrap: true,
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      itemCount: 7,
      itemBuilder: (context, index) {
        final day = weekStart.add(Duration(days: index));
        final dayKey = DateTime(day.year, day.month, day.day);
        final events = weekEvents[dayKey] ?? [];
        final isToday = _isToday(day);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildDayHeader(context, colorScheme, day, isToday),
            if (events.isEmpty)
              Padding(
                padding: const EdgeInsets.only(
                  left: AppTheme.spacingLg,
                  bottom: AppTheme.spacingSm,
                ),
                child: Text(
                  trad(context)!.no_events_for_date,
                  style: TextStyle(
                    fontSize: 12,
                    color: colorScheme.onSurface.withValues(alpha: 0.5),
                    fontFamily: AppTheme.defaultFontFamilyName,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              )
            else
              ...events.map(
                (e) => Padding(
                  padding: const EdgeInsets.only(left: AppTheme.spacingMd),
                  child: _buildEventItem(context, colorScheme, e),
                ),
              ),
            if (index < 6) const Divider(height: AppTheme.spacingMd),
          ],
        );
      },
    );
  }

  Widget _buildMonthlyView(BuildContext context, ColorScheme colorScheme) {
    final monthEvents = _getEventsForMonth();
    final firstDayOfMonth = DateTime(_selectedDate.year, _selectedDate.month, 1);
    final lastDayOfMonth = DateTime(
      _selectedDate.year,
      _selectedDate.month + 1,
      0,
    );
    final daysInMonth = lastDayOfMonth.day;
    final firstWeekday = firstDayOfMonth.weekday;

    // Build a grid of the month
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      child: Column(
        children: [
          // Week day headers
          Row(
            children: List.generate(7, (index) {
              final weekday = (index + 1) % 7; // Monday first
              final names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
              return Expanded(
                child: Center(
                  child: Text(
                    names[weekday == 0 ? 6 : weekday - 1],
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
                      fontFamily: AppTheme.defaultFontFamilyName,
                    ),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: AppTheme.spacingSm),
          // Calendar grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 1,
            ),
            itemCount: 42, // 6 weeks
            itemBuilder: (context, index) {
              final dayOffset = index - (firstWeekday - 1);
              if (dayOffset < 1 || dayOffset > daysInMonth) {
                return const SizedBox.shrink();
              }

              final day = DateTime(
                _selectedDate.year,
                _selectedDate.month,
                dayOffset,
              );
              final dayKey = DateTime(day.year, day.month, day.day);
              final events = monthEvents[dayKey] ?? [];
              final isToday = _isToday(day);

              return _buildMonthDay(
                context,
                colorScheme,
                dayOffset,
                events,
                isToday,
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMonthDay(
    BuildContext context,
    ColorScheme colorScheme,
    int day,
    List<CalendarEvent> events,
    bool isToday,
  ) {
    return Container(
      margin: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: isToday
            ? colorScheme.primary.withValues(alpha: 0.1)
            : events.isNotEmpty
                ? colorScheme.secondary.withValues(alpha: 0.1)
                : null,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: isToday
            ? Border.all(color: colorScheme.primary, width: 2)
            : null,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '$day',
            style: TextStyle(
              fontSize: 12,
              fontWeight: isToday ? FontWeight.w700 : FontWeight.w500,
              color: isToday ? colorScheme.primary : colorScheme.onSurface,
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
          if (events.isNotEmpty)
            Container(
              width: 6,
              height: 6,
              margin: const EdgeInsets.only(top: 2),
              decoration: BoxDecoration(
                color: colorScheme.secondary,
                shape: BoxShape.circle,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDayHeader(
    BuildContext context,
    ColorScheme colorScheme,
    DateTime day,
    bool isToday,
  ) {
    final dayFormat = DateFormat.E();
    final dateFormat = DateFormat.MMMd();

    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppTheme.spacingXs),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppTheme.spacingSm,
              vertical: AppTheme.spacingXs,
            ),
            decoration: BoxDecoration(
              color: isToday
                  ? colorScheme.primary
                  : colorScheme.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            ),
            child: Text(
              isToday ? trad(context)!.today : dayFormat.format(day),
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isToday
                    ? colorScheme.onPrimary
                    : colorScheme.onSurface,
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
          ),
          const SizedBox(width: AppTheme.spacingSm),
          Text(
            dateFormat.format(day),
            style: TextStyle(
              fontSize: 12,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEventItem(
    BuildContext context,
    ColorScheme colorScheme,
    CalendarEvent event,
  ) {
    final timeFormat = DateFormat.Hm();

    return Container(
      margin: const EdgeInsets.only(bottom: AppTheme.spacingSm),
      padding: const EdgeInsets.all(AppTheme.spacingSm),
      decoration: BoxDecoration(
        color: colorScheme.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: Border(
          left: BorderSide(color: colorScheme.primary, width: 3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            event.title,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: colorScheme.onSurface,
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Row(
            children: [
              Icon(
                Icons.access_time_rounded,
                size: 12,
                color: colorScheme.onSurface.withValues(alpha: 0.6),
              ),
              const SizedBox(width: 4),
              Text(
                event.isAllDay
                    ? trad(context)!.all_day
                    : '${timeFormat.format(event.startDateTime)} - ${timeFormat.format(event.endDateTime)}',
                style: TextStyle(
                  fontSize: 11,
                  color: colorScheme.onSurface.withValues(alpha: 0.6),
                  fontFamily: AppTheme.defaultFontFamilyName,
                ),
              ),
            ],
          ),
          if (event.location != null && event.location!.isNotEmpty) ...[
            const SizedBox(height: 2),
            Row(
              children: [
                Icon(
                  Icons.location_on_rounded,
                  size: 12,
                  color: colorScheme.error.withValues(alpha: 0.8),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    event.location!,
                    style: TextStyle(
                      fontSize: 11,
                      color: colorScheme.onSurface.withValues(alpha: 0.6),
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
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, ColorScheme colorScheme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingXl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.event_busy_rounded,
              size: 48,
              color: colorScheme.onSurface.withValues(alpha: 0.3),
            ),
            const SizedBox(height: AppTheme.spacingMd),
            Text(
              trad(context)!.no_events_for_date,
              style: TextStyle(
                fontSize: 14,
                color: colorScheme.onSurface.withValues(alpha: 0.6),
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooter(BuildContext context, ColorScheme colorScheme) {
    return Container(
      padding: const EdgeInsets.all(AppTheme.spacingMd),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '${widget.events.length} ${widget.events.length == 1 ? 'event' : 'events'}',
            style: TextStyle(
              fontSize: 12,
              color: colorScheme.onSurface.withValues(alpha: 0.6),
              fontFamily: AppTheme.defaultFontFamilyName,
            ),
          ),
          TextButton(
            onPressed: _goToToday,
            child: Text(
              trad(context)!.today,
              style: TextStyle(
                color: colorScheme.primary,
                fontWeight: FontWeight.w600,
                fontFamily: AppTheme.defaultFontFamilyName,
              ),
            ),
          ),
        ],
      ),
    );
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year &&
        date.month == now.month &&
        date.day == now.day;
  }
}
