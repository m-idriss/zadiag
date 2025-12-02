<div align="center">

# Zadiag

**Comprehensive Diagnostic & Tracking Application**

[![Flutter](https://img.shields.io/badge/Flutter-3.7%2B-02569B?logo=flutter)](https://flutter.dev)
[![Dart](https://img.shields.io/badge/Dart-3.0%2B-0175C2?logo=dart)](https://dart.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Style: Lint](https://img.shields.io/badge/style-lint-4BC0F5.svg)](https://pub.dev/packages/flutter_lints)

<p align="center">
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#roadmap">Roadmap</a>
</p>

</div>

---

## 🚀 About

**Zadiag** is a cutting-edge Flutter application designed to provide users with powerful diagnostic and tracking tools wrapped in a premium, animated user interface. Leveraging the power of Rive animations and modern design principles, Zadiag offers a seamless experience for tracking activities, managing appointments, and visualizing data.

## ✨ Features

| Feature | Description |
| :--- | :--- |
| **📊 Interactive Dashboard** | A dynamic home screen featuring smooth transitions and engaging animations that bring your data to life. |
| **🔥 Activity Heatmap** | Visualize your daily activity intensity over time with an intuitive and beautiful heatmap calendar. |
| **📸 Capture Tool** | Integrated camera and screen capture functionality for quick documentation and logging. |
| **📅 AI Calendar Converter** | **(New!)** Convert images of appointments directly into ICS calendar events using smart text recognition. |
| **🎨 Branding Studio** | Customize the look and feel of the application with a dedicated branding management suite. |
| **👤 Profile Management** | Comprehensive user profile settings to tailor the application to your preferences. |
| **🎬 Rive Animations** | High-quality, interactive animations that respond to user input for a delightful UX. |

## 📱 Screenshots

<div align="center">
  <!-- Replace these with actual screenshots/GIFs -->
  <img src="https://via.placeholder.com/250x500?text=Dashboard" alt="Dashboard" width="200" />
  <img src="https://via.placeholder.com/250x500?text=Heatmap" alt="Heatmap" width="200" />
  <img src="https://via.placeholder.com/250x500?text=Converter" alt="Converter" width="200" />
</div>

## 🛠 Tech Stack

-   **Framework**: [Flutter](https://flutter.dev/)
-   **Language**: [Dart](https://dart.dev/)
-   **Animations**: [Rive](https://rive.app/)
-   **Backend**: [Firebase](https://firebase.google.com/) (Auth, Firestore)
-   **Visualization**: [flutter_heatmap_calendar](https://pub.dev/packages/flutter_heatmap_calendar)
-   **State Management**: `setState` / `ValueNotifier` (Simple & Effective)

## 📂 Project Structure

```
lib/
├── core/                   # Core utilities, constants, and theme
│   ├── constants/          # App-wide constants (Theme, Strings)
│   └── utils/              # Helper functions (UI, Translation)
├── features/               # Feature-based modules
│   ├── auth/               # Authentication screens and logic
│   ├── converter/          # Image to ICS converter feature
│   └── diag/               # Main diagnostic screens (Dashboard, Heatmap)
├── shared/                 # Shared widgets and models
│   ├── components/         # Reusable UI components
│   └── models/             # Data models
└── main.dart               # Application entry point
```

## 🏁 Getting Started

Follow these steps to get a local copy up and running.

### Prerequisites

-   [Flutter SDK](https://flutter.dev/docs/get-started/install) (3.7.2+)
-   Dart SDK
-   A Firebase project configured (for Auth/Database features)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/zadiag.git
    cd zadiag
    ```

2.  **Install dependencies**
    ```bash
    flutter pub get
    ```

3.  **Run the application**
    ```bash
    flutter run
    ```

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
