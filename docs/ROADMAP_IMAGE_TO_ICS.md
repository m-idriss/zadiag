# 📅 Roadmap: Image to ICS Converter Feature

## Overview

This document outlines the development roadmap for implementing the **Image to ICS Converter** feature in the Zadiag Flutter app. This feature allows users to convert images of appointments, schedules, or calendars into ICS (iCalendar) events that can be imported into any calendar application.

## 🎯 Feature Goals

- Allow users to upload or capture images containing appointment/event information
- Use AI (via Firebase and api.3dime.com) to extract event details from images
- Generate ICS files from extracted events
- Provide a preview of events in a calendar view
- Enable users to edit events before export
- Download/share the generated ICS file

## 📋 Implementation Phases

### Phase 1: Core Infrastructure
**Target: Foundation Setup**

- [ ] **API Service Layer**
  - Create `ConverterService` class for API communication
  - Implement POST request to `https://api.3dime.com/?target=converter`
  - Handle request/response data structures:
    ```dart
    // Request payload
    {
      "files": [
        {
          "dataUrl": "base64_encoded_image",
          "name": "image_filename",
          "type": "image/jpeg"
        }
      ],
      "timeZone": "user_timezone",
      "currentDate": "current_date_iso"
    }
    ```
  - Implement error handling and retry logic

- [ ] **Data Models**
  - Create `CalendarEvent` model with fields:
    - `title` - Event name/summary
    - `description` - Event details
    - `startDateTime` - Start date and time
    - `endDateTime` - End date and time
    - `location` - Event location (optional)
    - `reminders` - List of reminder times
  - Create `ConversionResult` model for API response
  - Create `ImageFile` model for upload data

### Phase 2: Image Capture & Upload
**Target: User Input Flow**

- [ ] **Image Selection**
  - Integrate `image_picker` package for:
    - Camera capture
    - Gallery selection
  - Support multiple image selection
  - Image compression for optimal upload size

- [ ] **UI Components**
  - Update `CaptureScreen` with image upload zone
  - Add drag-and-drop support (web platform)
  - Display image preview before submission
  - Show upload progress indicator

### Phase 3: Event Processing
**Target: API Integration**

- [ ] **Processing Flow**
  - Submit image(s) to converter API
  - Display processing state with animation
  - Handle and display extracted events
  - Error handling with user-friendly messages

### Phase 4: Calendar Preview
**Target: Event Visualization**

- [ ] **Event List View**
  - List all extracted events
  - Show event details in cards
  - Quick actions (edit, delete, select)

- [ ] **Calendar View Component**
    - Integrate calendar widget (e.g., `table_calendar` or `syncfusion_flutter_calendar`)
    - Display extracted events in monthly/weekly/daily views
    - Color-code events by type or source

### Phase 5: ICS Generation & Export
**Target: Output Generation**

- [ ] **ICS Generator**
  - Implement ICS file format generation
  - Include all event properties:
    ```
    BEGIN:VCALENDAR
    VERSION:2.0
    PRODID:-//Zadiag//Image to ICS//EN
    BEGIN:VEVENT
    DTSTART:20240101T090000Z
    DTEND:20240101T100000Z
    SUMMARY:Event Title
    DESCRIPTION:Event Description
    LOCATION:Event Location
    END:VEVENT
    END:VCALENDAR
    ```
  - Support multiple events per file

- [ ] **Export Options**
  - Download ICS file
  - Share to other apps
  - Add directly to device calendar
  - Copy event details to clipboard

### Phase 6: Event Editing
**Target: User Control**

- [ ] **Event Editor**
    - Create/edit event form with fields:
        - Title (required)
        - Start date/time (required)
        - End date/time (required)
        - Description (optional)
        - Location (optional)
        - All-day toggle
    - Date/time pickers
    - Form validation

- [ ] **Batch Operations**
    - Select multiple events
    - Delete selected events
    - Bulk edit common fields
  
## 🛠 Technical Requirements

### Dependencies to Add

```yaml
dependencies:
  # Image handling
  image_picker: ^1.0.0
  image_cropper: ^5.0.0

  # Calendar display
  table_calendar: ^3.0.0
  # OR
  syncfusion_flutter_calendar: ^24.0.0

  # File handling
  path_provider: ^2.1.0
  share_plus: ^7.0.0

  # HTTP requests
  http: ^1.1.0
  # OR already using firebase
```

### API Endpoint

```
URL: https://api.3dime.com/?target=converter
Method: POST
Content-Type: application/json

Request Body:
{
  "files": [
    {
      "dataUrl": "data:image/jpeg;base64,/9j/4AAQ...",
      "name": "appointment.jpg",
      "type": "image/jpeg"
    }
  ],
  "timeZone": "Europe/Paris",
  "currentDate": "2024-01-15T10:30:00.000Z"
}
```

### File Structure

```
lib/
├── features/
│   └── converter/
│       ├── converter_page.dart         # Main page
│       ├── screens/
│       │   ├── upload_screen.dart      # Image upload UI
│       │   ├── preview_screen.dart     # Calendar preview
│       │   └── edit_screen.dart        # Event editing
│       ├── services/
│       │   ├── converter_service.dart  # API calls
│       │   └── ics_generator.dart      # ICS file generation
│       ├── models/
│       │   ├── calendar_event.dart     # Event model
│       │   └── conversion_result.dart  # API response model
│       └── widgets/
│           ├── event_card.dart         # Event display card
│           ├── calendar_view.dart      # Calendar widget
│           └── image_upload_zone.dart  # Upload component
```

## 🎨 UI/UX Design Guidelines

### Upload Screen
- Large drop zone for image upload
- Clear visual feedback on drag-over
- Multiple file selection support
- Image preview thumbnails
- "Convert" action button

### Preview Screen
- Calendar view toggle (month/week/day)
- Event list below calendar
- Color-coded events
- Edit button on each event
- "Download ICS" prominent button

### Edit Screen
- Clean form layout
- Date/time pickers
- Form validation messages
- Save/Cancel buttons

## 📊 Success Metrics

- [ ] Image upload success rate > 95%
- [ ] Event extraction accuracy > 90%
- [ ] ICS file generation success rate = 100%
- [ ] User satisfaction score > 4.0/5.0

## 🔐 Security Considerations

- Validate image file types before upload
- Sanitize API responses
- Implement rate limiting
- Secure API key storage
- User data privacy compliance

## 📱 Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Android  | Planned | Full support |
| iOS      | Planned | Full support |
| Web      | Planned | Limited file system access |
| Windows  | Planned | Full support |
| macOS    | Planned | Full support |
| Linux    | Planned | Full support |

## 🚀 Milestones

| Milestone | Description | Target |
|-----------|-------------|--------|
| M1 | API service + data models | Week 1-2 |
| M2 | Image capture/upload UI | Week 3-4 |
| M3 | Calendar preview | Week 5-6 |
| M4 | Event editing | Week 7-8 |
| M5 | ICS export | Week 9 |
| M6 | Testing & polish | Week 10-12 |

## 📚 References

- [iCalendar Specification (RFC 5545)](https://datatracker.ietf.org/doc/html/rfc5545)
- [Flutter Image Picker](https://pub.dev/packages/image_picker)
- [Table Calendar Package](https://pub.dev/packages/table_calendar)
- [Original Angular Implementation](https://github.com/user-attachments/files/23862776/converter.ts)
- [API Documentation: api.3dime.com](https://api.3dime.com)

---

*Last Updated: December 2024*
*Status: Planning Phase*
