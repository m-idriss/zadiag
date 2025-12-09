import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/features/converter/models/calendar_event.dart';

class DayEventCard extends StatelessWidget {
  final CalendarEvent event;
  final VoidCallback? onTap;

  const DayEventCard({super.key, required this.event, this.onTap});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(left: 4, right: 4, bottom: 1),
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

            final showTime = availableHeight > 35 && !event.isAllDay;
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
                      fontFamily: AppTheme.defaultFontFamilyName,
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
                      color: colorScheme.onSurface.withValues(alpha: 0.7),
                      fontFamily: AppTheme.defaultFontFamilyName,
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
            );
          },
        ),
      ),
    );
  }
}
