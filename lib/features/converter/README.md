# Conversion History & Heatmap Tracker

## Overview

The Conversion History feature tracks when users convert events to ICS format, stores the conversion history in Firebase Firestore, and provides:
- **Activity Heatmap**: Visualize conversion frequency over the past 365 days
- **Conversion Archive**: Browse and retrieve past conversions
- **Event Details**: View all events from previous conversions

## Prerequisites

### 1. Firebase Setup

This feature requires Firebase Firestore to be configured in your project.

#### Check Firebase Configuration

Verify that Firebase is already initialized in your project:
- ✅ `firebase_core` and `cloud_firestore` packages are in [pubspec.yaml](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/pubspec.yaml)
- ✅ Firebase is initialized in [main.dart](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/lib/main.dart)
- ✅ Firebase configuration exists in [firebase_options.dart](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/lib/firebase_options.dart)

#### Firestore Security Rules

Add the following Firestore security rules to allow users to read/write their own conversions:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Conversion history rules
    match /conversions/{conversionId} {
      // Users can only read their own conversions
      allow read: if request.auth != null && 
                     resource.data.userId == request.auth.uid;
      
      // Users can only create conversions for themselves
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid;
      
      // Users can only delete their own conversions
      allow delete: if request.auth != null && 
                       resource.data.userId == request.auth.uid;
    }
  }
}
```

Apply these rules in your Firebase Console:
1. Go to Firebase Console → Firestore Database → Rules
2. Add the above rules
3. Click "Publish"

### 2. Localization Generation

After adding the translation keys, generate the localization files:

```bash
cd <project-root>
flutter gen-l10n
```

This command generates Dart code from the ARB files in `lib/l10n/`.

## How It Works

### Data Flow

```
User converts events → Exports/Copies ICS
                          ↓
    ConversionHistoryService saves to Firestore
                          ↓
    ConversionHistoryProvider streams data
                          ↓
    ┌─────────────────────┴─────────────────────┐
    ↓                                           ↓
HeatMap Screen                     Conversion Archive Screen
(visualization)                    (detailed history)
```

### Data Model

Each conversion is stored in Firestore with the following structure:

```dart
{
  "timestamp": Timestamp,        // When conversion occurred
  "events": [                    // Array of calendar events
    {
      "id": String,
      "title": String,
      "startDateTime": String,
      "endDateTime": String,
      "location": String?,
      "description": String?,
      "isAllDay": bool,
      "reminders": [int]
    }
  ],
  "eventCount": int,             // Number of events
  "icsContent": String,          // Full ICS file content
  "userId": String               // User who created conversion
}
```

## Features

### 1. Automatic Conversion Tracking

Conversions are automatically saved when users:
- Download ICS files via the "Download ICS" button
- Copy ICS content to clipboard

**Implementation**: [converter_page.dart](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/lib/features/converter/converter_page.dart)

### 2. Activity Heatmap

The heatmap shows conversion frequency with a color-coded intensity scale:
- Gray: No conversions
- Light color: 1 conversion
- Medium color: 2-3 conversions  
- Dark color: 4+ conversions

**Features**:
- Displays past 365 days
- Click any date to see conversion details
- "View Archive" button to access full history

**Implementation**: [heatmap_screen.dart](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/lib/features/diag/screens/heatmap_screen.dart)

### 3. Conversion Archive

Browse all conversion history with:
- Reverse chronological order (newest first)
- Expandable cards showing event details
- Copy and Preview actions for each conversion
- Real-time updates via Firestore streams

**Implementation**: [conversion_archive_screen.dart](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/lib/features/converter/screens/conversion_archive_screen.dart)

## Architecture

### Service Layer

**[ConversionHistoryService](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/lib/features/converter/services/conversion_history_service.dart)**
- `saveConversion()`: Save a new conversion to Firestore
- `streamUserConversions()`: Stream all user conversions
- `getConversionsForDate()`: Get conversions for a specific date
- `getConversionCountsForRange()`: Get conversion counts for heatmap
- `deleteConversion()`: Delete a conversion record
- `getStatistics()`: Get total conversion stats

### State Management

**[ConversionHistoryProvider](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/lib/features/converter/providers/conversion_history_provider.dart)**

Riverpod providers:
- `conversionHistoryServiceProvider`: Service instance
- `conversionHistoryStreamProvider`: Stream of all conversions
- `conversionHeatmapDataProvider`: Aggregated heatmap data (0-4 scale)
- `conversionStatisticsProvider`: Total conversions and events

### Data Model

**[ConversionHistory](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/lib/features/converter/models/conversion_history.dart)**
- Model with Firestore serialization
- Includes timestamp, events, ICS content, user ID

## Usage Guide

### For End Users

1. **Convert Events**: Upload images and convert to calendar events as usual
2. **Export**: Click "Download ICS" or "Copy to Clipboard" → Conversion is saved automatically
3. **View Activity**: Navigate to "Activity Tracking" tab to see the heatmap
4. **Browse History**: Click "View Archive" to see all past conversions
5. **Retrieve Old Conversions**: Expand any conversion card to view details and copy/preview ICS content

### For Developers

#### Adding Conversion Tracking to New Export Methods

If you add new ways to export ICS files, save the conversion using:

```dart
import 'package:zadiag/features/converter/services/conversion_history_service.dart';

final _historyService = ConversionHistoryService();

// After successful export
try {
  await _historyService.saveConversion(
    events: extractedEvents,        // List<CalendarEvent>
    icsContent: generatedIcsString, // String
  );
} catch (e) {
  // Handle error (don't block user flow)
  print('Error saving to history: $e');
}
```

#### Accessing Conversion Data

Use Riverpod providers in your widgets:

```dart
// Stream all conversions
final conversionsAsync = ref.watch(conversionHistoryStreamProvider);

// Get heatmap data
final heatmapDataAsync = ref.watch(conversionHeatmapDataProvider);

// Get statistics
final statsAsync = ref.watch(conversionStatisticsProvider);
```

## Troubleshooting

### Conversions Not Saving

**Issue**: Conversions don't appear in the archive or heatmap.

**Solutions**:
1. Check Firebase authentication - user must be logged in
2. Verify Firestore security rules are configured correctly
3. Check Firestore Console to see if data is being written
4. Look for errors in the console/logs

### Heatmap Shows No Data

**Issue**: Heatmap appears empty even with conversions.

**Solutions**:
1. Verify conversions exist in Firestore Console (`conversions` collection)
2. Check that `userId` field matches the authenticated user
3. Ensure dates are within the past 365 days
4. Check for provider errors in the UI error state

### Translation Keys Not Found

**Issue**: App shows errors like "The getter 'view_archive' isn't defined"

**Solution**:
```bash
flutter gen-l10n
```

If the command fails:
1. Ensure `flutter` is in your PATH
2. Check `l10n.yaml` configuration exists
3. Verify ARB files are valid JSON

### Performance Issues

**Issue**: Archive screen loads slowly with many conversions.

**Solutions**:
1. Firestore automatically paginates queries
2. Consider adding pagination for very large datasets (100+ conversions)
3. Add indexes in Firestore Console if needed:
   - Collection: `conversions`
   - Fields: `userId` (Ascending), `timestamp` (Descending)

## Localization

The feature supports internationalization with keys in:
- [app_en.arb](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/lib/l10n/app_en.arb) (English)
- [app_fr.arb](file:///Users/idriss/dev/projects/2025/dime/appli/zadiag/lib/l10n/app_fr.arb) (French)

Translation keys added:
- `conversion_archive`
- `conversion_archive_subtitle`
- `no_conversions_yet`
- `events_converted`
- `view_archive`
- `events`
- `preview`
- `no_conversions_on_date`

## File Structure

```
lib/features/converter/
├── models/
│   └── conversion_history.dart          # Data model
├── services/
│   └── conversion_history_service.dart  # Firestore operations
├── providers/
│   └── conversion_history_provider.dart # Riverpod state management
├── screens/
│   └── conversion_archive_screen.dart   # Archive UI
└── converter_page.dart                  # Updated with tracking

lib/features/diag/screens/
└── heatmap_screen.dart                  # Updated with real data

lib/l10n/
├── app_en.arb                           # English translations
└── app_fr.arb                           # French translations
```

## Testing

### Manual Testing Checklist

- [ ] Convert events and export ICS file → Verify saved to Firestore
- [ ] Copy ICS to clipboard → Verify saved to Firestore  
- [ ] Navigate to Activity Tracker → See conversions on heatmap
- [ ] Click date on heatmap → See conversion details modal
- [ ] Click "View Archive" → See archive screen with conversions
- [ ] Expand conversion card → See event details
- [ ] Click "Copy" on conversion → ICS copied to clipboard
- [ ] Click "Preview" on conversion → Modal shows ICS content
- [ ] Perform conversion on different days → See different activity levels
- [ ] Test with no conversions → See empty states

### Firestore Console Checks

1. Open Firebase Console → Firestore Database
2. Navigate to `conversions` collection
3. Verify documents have correct structure:
   - `userId` matches authenticated user
   - `timestamp` is a Firestore Timestamp
   - `events` is an array of event objects
   - `eventCount` is a number
   - `icsContent` is a string

## Future Enhancements

Potential improvements:
- Export conversion history as CSV/JSON
- Search/filter conversions by date range
- Delete individual conversions
- Statistics dashboard (most active days, total events converted)
- Share conversions with other users
- Backup/restore conversion history

## Support

For issues or questions:
1. Check this README
2. Review the [walkthrough documentation](file:///Users/idriss/.gemini/antigravity/brain/e1b44073-8fcb-4d39-a3f9-00c7baa790c3/walkthrough.md)
3. Check Firebase Console for data/errors
4. Review Flutter logs for error messages
