import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zadiag/shared/models/menu.dart';

/// Provider to control the selected bottom navigation page
class BottomNavNotifier extends StateNotifier<Menu> {
  BottomNavNotifier() : super(bottomNavItems[0]);

  void selectPage(Menu menu) {
    state = menu;
  }

  void selectPageByIndex(int index) {
    if (index >= 0 && index < bottomNavItems.length) {
      state = bottomNavItems[index];
    }
  }

  void selectConverterPage() {
    // Index 1 is the Converter page in the bottom navigation
    selectPageByIndex(1);
  }
}

final bottomNavProvider = StateNotifierProvider<BottomNavNotifier, Menu>((ref) {
  return BottomNavNotifier();
});
