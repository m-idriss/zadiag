# Zadiag

Zadiag is a Flutter application designed to provide comprehensive diagnostic and tracking tools. It features a modern, animated user interface with Rive animations and a suite of tools including activity heatmaps, capture capabilities, and branding customization.

## Features

-   **Interactive Dashboard**: A dynamic home screen with smooth transitions and animations.
-   **Activity Heatmap**: Visualize your activity or data over time with an intuitive heatmap.
-   **Capture Tool**: Integrated camera or screen capture functionality.
-   **AI Calendar Converter**: Convert images of appointments into ICS calendar events (see [Roadmap](docs/ROADMAP_IMAGE_TO_ICS.md)).
-   **Branding Customization**: Tools to manage and preview branding elements.
-   **Profile Management**: User profile settings and preferences.
-   **Rive Animations**: High-quality, interactive animations for a premium user experience.

## Getting Started

This project is a starting point for a Flutter application.

### Prerequisites

-   [Flutter SDK](https://flutter.dev/docs/get-started/install) (version 3.7.2 or higher)
-   Dart SDK

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/yourusername/zadiag.git
    cd zadiag
    ```

2.  **Install dependencies:**

    ```bash
    flutter pub get
    ```

3.  **Run the application:**

    ```bash
    flutter run
    ```

## Built With

-   [Flutter](https://flutter.dev/) - UI Toolkit
-   [Rive](https://rive.app/) - Interactive Animations
-   [Firebase](https://firebase.google.com/) - Backend Services (Auth, Firestore, Database)
-   [Flutter Heatmap Calendar](https://pub.dev/packages/flutter_heatmap_calendar) - Heatmap Visualization

## Folder Structure

-   `lib/features`: Contains the main feature modules (Auth, Diag, etc.).
-   `lib/core`: Core utilities, constants, and theme definitions.
-   `lib/shared`: Shared components and models used across the app.
-   `assets`: Images, icons, and Rive animation files.
-   `docs`: Project documentation and roadmaps.

## Resources

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
