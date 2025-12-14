# Zadiag Design System

## 📚 Overview

This document describes the Zadiag application design system - a unified set of UI components, styles, and patterns that ensure visual consistency and professional appearance across the entire application.

## 🎨 Core Principles

1. **Consistency** - All screens use the same components and styling
2. **Reusability** - Components are designed to be used across multiple screens
3. **Maintainability** - Centralized styling makes updates easy
4. **Accessibility** - Components support different themes and text sizes

## 🌈 Color Palette

### Light Theme
- **Primary**: `#2563EB` (Vibrant Blue)
- **Secondary**: `#7C3AED` (Purple Accent)
- **Tertiary**: `#F8FAFC` (Light Background)
- **Error**: `#DC2626` (Red)
- **Surface**: `#FFFFFF` (White)
- **Outline**: `#E2E8F0` (Light Gray)

### Dark Theme
- **Primary**: `#3B82F6` (Bright Blue)
- **Secondary**: `#8B5CF6` (Vibrant Purple)
- **Tertiary**: `#1E293B` (Dark Surface)
- **Error**: `#EF4444` (Bright Red)
- **Surface**: `#0F172A` (Deep Dark)
- **Outline**: `#334155` (Dark Gray)

Access colors via:
```dart
final colorScheme = Theme.of(context).colorScheme;
final primary = colorScheme.primary;
```

## 📏 Spacing Scale

Use consistent spacing throughout the app:

```dart
AppTheme.spacingXs   // 4.0
AppTheme.spacingSm   // 8.0
AppTheme.spacingMd   // 16.0
AppTheme.spacingLg   // 24.0
AppTheme.spacingXl   // 32.0
AppTheme.spacingXxl  // 48.0
```

## 🔲 Border Radius

```dart
AppTheme.radiusXs    // 4.0
AppTheme.radiusSm    // 8.0
AppTheme.radiusMd    // 12.0
AppTheme.radiusLg    // 16.0
AppTheme.radiusXl    // 24.0
AppTheme.radiusXxl   // 32.0
AppTheme.radiusFull  // 9999.0 (fully rounded)
```

## ✍️ Typography

### Heading Styles
```dart
// Large heading (28px, bold)
AppTheme.headingStyle(colorScheme.onSurface)

// Section title (18px, bold)
AppTheme.titleStyle(colorScheme.onSurface)
```

### Body Styles
```dart
// Regular body text (14px)
AppTheme.bodyStyle(colorScheme.onSurface)

// Secondary/label text (12px, 60% opacity)
AppTheme.labelStyle(colorScheme.onSurface)
```

### Button Styles
```dart
// Standard button text (14px, semi-bold)
AppTheme.buttonStyle(color: Colors.white)

// Large button text (17px, bold)
AppTheme.buttonStyleLarge(color: Colors.white)
```

### Material 3 Text Theme
Also available via `Theme.of(context).textTheme`:
- `displayLarge`, `displayMedium`, `displaySmall`
- `headlineLarge`, `headlineMedium`, `headlineSmall`
- `titleLarge`, `titleMedium`, `titleSmall`
- `bodyLarge`, `bodyMedium`, `bodySmall`
- `labelLarge`, `labelMedium`, `labelSmall`

## 🧩 Reusable Components

### AppScaffold
Standardized scaffold with consistent header and background.

```dart
AppScaffold(
  title: 'Settings',
  body: ListView(...),
  showBackButton: true,
  useGradientBackground: true,
)
```

### AppButton Variants

#### Primary Button
For main actions (Sign In, Register, Convert, etc.)
```dart
PrimaryButton(
  label: 'Convert',
  icon: Icons.transform,
  onPressed: () {},
  isFullWidth: true,
)
```

#### Secondary Button
For secondary actions
```dart
SecondaryButton(
  label: 'Cancel',
  icon: Icons.close,
  onPressed: () {},
  color: colorScheme.secondary,
)
```

#### Danger Button
For destructive actions (Delete, Logout, etc.)
```dart
DangerButton(
  label: 'Delete Account',
  icon: Icons.delete_forever,
  onPressed: () {},
  isOutlined: false,
)
```

#### Text Button
For tertiary/inline actions
```dart
TextButton(
  label: 'Learn More',
  icon: Icons.info,
  onPressed: () {},
)
```

### AppListTile
For settings items, menu items, and list-based UI.

```dart
AppListTile(
  leadingIcon: Icons.notifications,
  title: 'Notifications',
  subtitle: 'Enabled',
  trailing: AppSwitch(
    value: true,
    onChanged: (value) {},
  ),
  onTap: () {},
)
```

### AppSection
For grouping related UI elements.

```dart
AppSection(
  title: 'ACCOUNT',
  description: 'Manage your profile settings',
  children: [
    AppListTile(...),
    AppListTile(...),
  ],
)
```

### AppSwitch
Consistent switch component.

```dart
AppSwitch(
  value: isEnabled,
  onChanged: (value) => setState(() => isEnabled = value),
)
```

### AppDivider
Section separators.

```dart
const AppDivider()

// With custom properties
AppDivider(
  indent: 16,
  endIndent: 16,
)
```

### AppTextField
Consistent text input fields.

```dart
AppTextField(
  labelText: 'Email',
  hintText: 'Enter your email',
  prefixIcon: Icons.email,
  keyboardType: TextInputType.emailAddress,
  validator: (value) => value?.isEmpty ?? true ? 'Required' : null,
)
```

### GlassContainer
Glassmorphic container with backdrop blur.

```dart
GlassContainer(
  padding: EdgeInsets.all(AppTheme.spacingMd),
  borderRadius: AppTheme.radiusXl,
  opacity: 0.9,
  child: YourWidget(),
)
```

## 🎭 Decoration Factories

Use centralized decoration factories from `AppTheme`:

```dart
// Card decoration
Container(
  decoration: AppTheme.cardDecoration(colorScheme),
  child: ...,
)

// Icon container
Container(
  decoration: AppTheme.iconContainerDecoration(
    colorScheme,
    useGradient: true,
  ),
  child: Icon(...),
)

// Glass/elevated container
Container(
  decoration: AppTheme.glassDecoration(
    colorScheme,
    isDarkMode: true,
  ),
  child: ...,
)

// Button with gradient
Container(
  decoration: AppTheme.buttonDecoration(colorScheme),
  child: ...,
)
```

## 📋 UI Governance Rules

1. **Always use existing components** - Don't create custom buttons, cards, or inputs
2. **Use AppTheme constants** - Never hardcode colors, spacing, or border radius
3. **Follow Material 3 patterns** - Leverage the theme system
4. **No inline styles** - Use decoration factories and text styles from AppTheme
5. **Justify exceptions** - Any deviation from the design system must be documented

## 🚫 Anti-Patterns (Don't Do This)

```dart
// ❌ Bad - Hardcoded colors and spacing
Container(
  padding: EdgeInsets.all(16),
  decoration: BoxDecoration(
    color: Color(0xFF2563EB),
    borderRadius: BorderRadius.circular(12),
  ),
)

// ✅ Good - Use AppTheme constants and decorations
Container(
  padding: EdgeInsets.all(AppTheme.spacingMd),
  decoration: AppTheme.cardDecoration(
    colorScheme,
    color: colorScheme.primary,
  ),
)
```

```dart
// ❌ Bad - Custom switch
Switch(
  value: value,
  onChanged: onChanged,
  activeColor: Colors.blue,
)

// ✅ Good - Use AppSwitch
AppSwitch(
  value: value,
  onChanged: onChanged,
)
```

## 🔄 Migration Guide

When refactoring existing screens:

1. Replace hardcoded `Container` widgets with `AppSection` or `GlassContainer`
2. Replace custom list items with `AppListTile`
3. Replace `Switch` with `AppSwitch`
4. Replace `Divider` with `AppDivider`
5. Replace `TextFormField` with `AppTextField`
6. Replace custom buttons with `PrimaryButton`, `SecondaryButton`, or `DangerButton`
7. Use `AppScaffold` instead of `Scaffold` for consistent layouts

## 📚 Example: Settings Screen Pattern

```dart
class SettingsScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: 'Settings',
      body: ListView(
        padding: EdgeInsets.all(AppTheme.spacingLg),
        children: [
          // Profile Section
          AppSection(
            title: 'PROFILE',
            children: [
              AppListTile(
                leadingIcon: Icons.person,
                title: 'Account',
                subtitle: 'Manage your profile',
                trailing: Icon(Icons.chevron_right),
                onTap: () {},
              ),
            ],
          ),
          
          const SizedBox(height: AppTheme.spacingMd),
          
          // Preferences Section
          AppSection(
            title: 'PREFERENCES',
            children: [
              AppListTile(
                leadingIcon: Icons.notifications,
                title: 'Notifications',
                trailing: AppSwitch(
                  value: true,
                  onChanged: (value) {},
                ),
              ),
              const AppDivider(indent: 60),
              AppListTile(
                leadingIcon: Icons.dark_mode,
                title: 'Dark Mode',
                trailing: AppSwitch(
                  value: false,
                  onChanged: (value) {},
                ),
              ),
            ],
          ),
          
          const SizedBox(height: AppTheme.spacingMd),
          
          // Actions
          PrimaryButton(
            label: 'Save Changes',
            icon: Icons.save,
            onPressed: () {},
            isFullWidth: true,
          ),
        ],
      ),
    );
  }
}
```

## 🎯 Reference Implementation

The **Account & Settings screens** serve as the reference implementation for the design system. When in doubt about how to implement a feature, check these screens for guidance.

## 📞 Questions?

If you need to add a new component or pattern that doesn't exist in the design system, discuss it with the team first to ensure it aligns with our design principles.
