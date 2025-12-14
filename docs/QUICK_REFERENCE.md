# Quick Reference Guide - Zadiag Design System

## 🎨 Colors

### Access Colors
```dart
final colorScheme = Theme.of(context).colorScheme;
```

### Common Colors
| Usage | Light Theme | Dark Theme | Access |
|-------|-------------|------------|--------|
| Primary | #2563EB (Blue) | #3B82F6 (Bright Blue) | `colorScheme.primary` |
| Secondary | #7C3AED (Purple) | #8B5CF6 (Vibrant Purple) | `colorScheme.secondary` |
| Error/Danger | #DC2626 (Red) | #EF4444 (Bright Red) | `colorScheme.error` |
| Background | #F8FAFC (Light) | #1E293B (Dark) | `colorScheme.tertiary` |
| Surface | #FFFFFF (White) | #0F172A (Deep Dark) | `colorScheme.surface` |
| Text | #1E293B | #F8FAFC | `colorScheme.onSurface` |

---

## 📏 Spacing

```dart
AppTheme.spacingXs    // 4.0  - Tiny gaps
AppTheme.spacingSm    // 8.0  - Small gaps
AppTheme.spacingMd    // 16.0 - Default padding
AppTheme.spacingLg    // 24.0 - Section spacing
AppTheme.spacingXl    // 32.0 - Large sections
AppTheme.spacingXxl   // 48.0 - Extra large spacing
```

**Most Common**: `spacingMd` (16.0) for padding, `spacingLg` (24.0) for section gaps

---

## 🔲 Border Radius

```dart
AppTheme.radiusSm     // 8.0  - Small rounded corners
AppTheme.radiusMd     // 12.0 - Default rounded corners
AppTheme.radiusLg     // 16.0 - Large rounded corners
AppTheme.radiusXl     // 24.0 - Extra large rounded
AppTheme.radiusFull   // 9999.0 - Fully rounded (circles)
```

**Most Common**: `radiusMd` (12.0) for cards, `radiusXl` (24.0) for containers

---

## 🔤 Typography

### Quick Text Styles
```dart
// Large heading (28px, bold)
Text('Settings', style: AppTheme.headingStyle(colorScheme.onSurface))

// Section title (18px, bold)
Text('Profile', style: AppTheme.titleStyle(colorScheme.onSurface))

// Body text (14px)
Text('Description', style: AppTheme.bodyStyle(colorScheme.onSurface))

// Small label (12px, 60% opacity)
Text('Subtitle', style: AppTheme.labelStyle(colorScheme.onSurface))
```

### Material 3 Theme
```dart
Theme.of(context).textTheme.titleLarge    // 22px, medium
Theme.of(context).textTheme.titleMedium   // 16px, medium
Theme.of(context).textTheme.bodyLarge     // 16px, regular
Theme.of(context).textTheme.bodyMedium    // 14px, regular
Theme.of(context).textTheme.labelLarge    // 14px, medium
```

---

## 🧩 Components Cheat Sheet

### AppScaffold
```dart
AppScaffold(
  title: 'Screen Title',              // Optional
  showBackButton: true,                // Show back arrow
  useGradientBackground: true,         // Gradient or solid
  body: YourContent(),
)
```

### Buttons

#### Primary (Gradient, Main Actions)
```dart
PrimaryButton(
  label: 'Convert',
  icon: Icons.transform,
  onPressed: () {},
  isFullWidth: true,
  isLoading: false,                    // Shows spinner
)
```

#### Secondary (Colored, Secondary Actions)
```dart
SecondaryButton(
  label: 'Cancel',
  icon: Icons.close,
  onPressed: () {},
  color: colorScheme.secondary,        // Optional custom color
  isLoading: false,
)
```

#### Danger (Red, Destructive Actions)
```dart
DangerButton(
  label: 'Delete',
  icon: Icons.delete,
  onPressed: () {},
  isOutlined: true,                    // Outlined or filled
  isLoading: false,
)
```

#### Text (Minimal, Tertiary Actions)
```dart
TextButton(
  label: 'Learn More',
  icon: Icons.info,
  onPressed: () {},
  color: colorScheme.primary,          // Optional
)
```

**Disabled State**: Set `onPressed: null`

### AppListTile
```dart
AppListTile(
  leadingIcon: Icons.notifications,    // Or use leading: CustomWidget()
  iconColor: colorScheme.primary,      // Optional icon color
  title: 'Notifications',
  subtitle: 'Enabled',                 // Optional
  trailing: AppSwitch(...),            // Optional trailing widget
  onTap: () {},                        // Optional
  showDivider: true,                   // Optional divider below
)
```

### AppSection
```dart
AppSection(
  title: 'ACCOUNT',                    // Optional uppercase title
  description: 'Manage settings',      // Optional description
  showBackground: true,                // Card background or transparent
  children: [
    AppListTile(...),
    AppListTile(...),
  ],
)
```

### AppSwitch
```dart
AppSwitch(
  value: isEnabled,
  onChanged: (val) => setState(() => isEnabled = val),
  activeColor: colorScheme.primary,    // Optional
)
```

### AppDivider
```dart
const AppDivider()                     // Default

AppDivider(
  indent: 60,                          // Left indent
  endIndent: 16,                       // Right indent
)
```

### AppTextField
```dart
AppTextField(
  labelText: 'Email',
  hintText: 'Enter your email',
  prefixIcon: Icons.email,
  keyboardType: TextInputType.emailAddress,
  validator: (value) {
    if (value?.isEmpty ?? true) return 'Required';
    return null;
  },
  onChanged: (value) {},
)
```

### GlassContainer
```dart
GlassContainer(
  padding: EdgeInsets.all(AppTheme.spacingMd),
  borderRadius: AppTheme.radiusXl,
  opacity: 0.9,
  child: YourWidget(),
)
```

---

## 🎨 Decoration Factories

### Card Decoration
```dart
Container(
  decoration: AppTheme.cardDecoration(
    colorScheme,
    borderRadius: AppTheme.radiusMd,
    color: colorScheme.surface,        // Optional
    borderColor: colorScheme.outline,  // Optional
    borderWidth: 1,                    // Optional
  ),
)
```

### Icon Container
```dart
Container(
  decoration: AppTheme.iconContainerDecoration(
    colorScheme,
    borderRadius: AppTheme.radiusMd,
    color: colorScheme.primary.withValues(alpha: 0.1),
    useGradient: false,                // Gradient or solid
  ),
)
```

### Glass Effect
```dart
Container(
  decoration: AppTheme.glassDecoration(
    colorScheme,
    borderRadius: AppTheme.radiusXl,
    isDarkMode: Theme.of(context).brightness == Brightness.dark,
  ),
)
```

### Button Gradient
```dart
Container(
  decoration: AppTheme.buttonDecoration(
    colorScheme,
    borderRadius: AppTheme.radiusLg,
  ),
)
```

---

## 📋 Common Patterns

### Settings List Item with Switch
```dart
AppListTile(
  leadingIcon: Icons.notifications,
  title: 'Push Notifications',
  subtitle: 'Get notified of updates',
  trailing: AppSwitch(
    value: notificationsEnabled,
    onChanged: (value) {
      setState(() => notificationsEnabled = value);
    },
  ),
)
```

### Settings List Item with Navigation
```dart
AppListTile(
  leadingIcon: Icons.person,
  title: 'Account',
  subtitle: 'Manage your profile',
  trailing: Icon(Icons.chevron_right),
  onTap: () {
    Navigator.push(...);
  },
)
```

### Settings Section
```dart
AppSection(
  title: 'PREFERENCES',
  children: [
    AppListTile(...),
    const AppDivider(indent: 60),
    AppListTile(...),
  ],
)
```

### Form with Buttons
```dart
Column(
  children: [
    AppTextField(
      labelText: 'Email',
      prefixIcon: Icons.email,
    ),
    const SizedBox(height: AppTheme.spacingMd),
    AppTextField(
      labelText: 'Password',
      prefixIcon: Icons.lock,
      obscureText: true,
    ),
    const SizedBox(height: AppTheme.spacingLg),
    PrimaryButton(
      label: 'Sign In',
      icon: Icons.login,
      onPressed: _handleSignIn,
      isFullWidth: true,
      isLoading: isLoading,
    ),
    const SizedBox(height: AppTheme.spacingSm),
    TextButton(
      label: 'Forgot Password?',
      onPressed: _handleForgotPassword,
    ),
  ],
)
```

### Action Buttons Row
```dart
Row(
  children: [
    Expanded(
      child: SecondaryButton(
        label: 'Cancel',
        onPressed: () => Navigator.pop(context),
      ),
    ),
    const SizedBox(width: AppTheme.spacingMd),
    Expanded(
      child: PrimaryButton(
        label: 'Save',
        onPressed: _handleSave,
      ),
    ),
  ],
)
```

---

## ✅ Do's

- ✅ Use `AppTheme` constants for spacing and radius
- ✅ Use `colorScheme` from theme for colors
- ✅ Use design system components
- ✅ Use decoration factories
- ✅ Follow Material 3 patterns

## ❌ Don'ts

- ❌ Hardcode colors: `Color(0xFF2563EB)`
- ❌ Hardcode spacing: `EdgeInsets.all(16)`
- ❌ Hardcode radius: `BorderRadius.circular(12)`
- ❌ Create custom buttons/switches
- ❌ Use inline `BoxDecoration`

---

## 📱 Import

### Single Import for All Components
```dart
import 'package:zadiag/shared/components/components.dart';
```

### Individual Imports
```dart
import 'package:zadiag/shared/components/app_scaffold.dart';
import 'package:zadiag/shared/components/app_buttons.dart';
import 'package:zadiag/shared/components/app_list_tile.dart';
// etc.
```

### Always Import
```dart
import 'package:zadiag/core/constants/app_theme.dart';
```

---

## 🎯 Need Help?

1. Check **Settings Screen** (`lib/features/diag/screens/settings_screen.dart`) - Reference implementation
2. Read **Design System Docs** (`docs/DESIGN_SYSTEM.md`) - Comprehensive guide
3. Read **Implementation Summary** (`docs/IMPLEMENTATION_SUMMARY.md`) - What was built

---

**Remember**: Settings screen is the visual reference. When in doubt, check how it's done there! 🎨
