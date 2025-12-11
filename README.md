<div align="center">

# Zadiag

**Comprehensive Diagnostic & Tracking Application**

[![Flutter](https://img.shields.io/badge/Flutter-3.7%2B-02569B?logo=flutter)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart-3.7%2B-0175C2?logo=dart)](https://dart.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Style: Lint](https://img.shields.io/badge/style-lint-4BC0F5.svg)](https://pub.dev/packages/flutter_lints)

<p>
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#roadmap">Roadmap</a>
</p>

</div>

---

## 🚀 About

**Zadiag** is a cutting-edge Flutter application designed to provide users with powerful diagnostic and tracking tools wrapped in a premium, animated user interface. Leveraging the power of Rive animations and modern design principles like Glassmorphism, Zadiag offers a seamless experience for tracking activities, managing appointments, and converting external schedules into digital formats.

<a id="features"></a>
## ✨ Features

| Feature | Description |
| :--- | :--- |
| **📊 Interactive Dashboard** | A dynamic home screen featuring smooth transitions and engaging animations that bring your data to life. |
| **🔥 Activity Heatmap** | Visualize your daily activity intensity over time with an intuitive and beautiful heatmap calendar. |
| **📅 AI Calendar Converter** | **(Core)** Convert images of physical appointments or PDF schedules directly into ICS calendar events using smart recognition. |
| **💾 Offline History** | Automatically save and browse your conversion history locally with persistent storage. |
| **🌍 Multi-language Support** | Fully localized interface available in English and French. |
| **📸 Capture Tool** | Integrated camera and screen capture functionality for quick documentation and logging. |
| **🎨 Branding Studio** | Customize the look and feel of the application with a dedicated branding management suite. |
| **👤 Profile Management** | Comprehensive user profile settings to tailor the application to your preferences. |
| **🎬 Rive Animations** | High-quality, interactive animations that respond to user input for a delightful UX. |

<a id="screenshots"></a>
## 📱 Screenshots

<div align="center">
  <!-- Replace these with actual screenshots/GIFs -->
  <img src="https://via.placeholder.com/250x500?text=Dashboard" alt="Dashboard" width="200" />
  <img src="https://via.placeholder.com/250x500?text=Heatmap" alt="Heatmap" width="200" />
  <img src="https://via.placeholder.com/250x500?text=Converter" alt="Converter" width="200" />
</div>

<a id="tech-stack"></a>
## 🛠 Tech Stack

-   **Framework**: [Flutter](https://flutter.dev/)
-   **Language**: [Dart](https://dart.dev/)
-   **Animations**: [Rive](https://rive.app/)
-   **Backend**: [Firebase](https://firebase.google.com/) (Auth, Firestore)
-   **Local Database**: [Isar](https://isar.dev/) (High-performance NoSQL)
-   **State Management**: [Riverpod](https://riverpod.dev/) (Modern & Reactive)
-   **Visualization**: [flutter_heatmap_calendar](https://pub.dev/packages/flutter_heatmap_calendar), [table_calendar](https://pub.dev/packages/table_calendar)
-   **Utilities**: [Logger](https://pub.dev/packages/logger) (Structured logging), [Share Plus](https://pub.dev/packages/share_plus)

## 📂 Project Structure

```
lib/
├── core/                   # Core utilities, constants, and theme
│   ├── constants/          # App-wide constants (Theme, Strings)
│   ├── core.dart           # Barrel export for core module
│   └── utils/              # Helper functions (UI, Translation, Navigation)
├── features/               # Feature-based modules
│   ├── auth/               # Authentication screens and logic
│   ├── converter/          # Image to ICS converter feature (Core)
│   │   ├── models/         # CalendarEvent, ConversionResult, UploadedImage
│   │   ├── providers/      # Riverpod state management
│   │   ├── services/       # API, ICS generation, Isar storage
│   │   └── widgets/        # EventCard, ImageUploadZone
│   └── diag/               # Main diagnostic screens (Dashboard, Heatmap)
│       └── screens/        # Profile, Settings, Heatmap, Capture
├── shared/                 # Shared widgets and models
│   ├── components/         # Reusable UI components (StandardCard, Buttons)
│   ├── models/             # Data models
│   └── shared.dart         # Barrel export for shared module
├── l10n/                   # Localization files (EN, FR)
└── main.dart               # Application entry point
```

<a id="getting-started"></a>
## 🏁 Getting Started

Follow these steps to get a local copy up and running.

### Prerequisites

-   [Flutter SDK](https://flutter.dev/docs/get-started/install) (3.7.2+)
-   Dart SDK (3.7.2+)
-   A Firebase project configured (for Auth/Database features)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/m-idriss/zadiag.git
    cd zadiag
    ```

2.  **Install dependencies**
    ```bash
    flutter pub get
    ```

3.  **Generate code (Required for Isar & Riverpod)**
    ```bash
    dart run build_runner build --delete-conflicting-outputs
    ```

4.  **Run the application**
    ```bash
    flutter run
    ```

<a id="roadmap"></a>
## 🗺 Roadmap

See our [Image to ICS Roadmap](docs/ROADMAP_IMAGE_TO_ICS.md) for upcoming features in the converter module.

## 🤝 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
