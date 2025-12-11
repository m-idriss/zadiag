import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum TextSize {
  small,
  normal,
  large;

  double get scaleFactor {
    switch (this) {
      case TextSize.small:
        return 0.875; // 87.5%
      case TextSize.normal:
        return 1.0; // 100%
      case TextSize.large:
        return 1.125; // 112.5%
    }
  }
}

class TextSizeNotifier extends StateNotifier<TextSize> {
  static const String _textSizeKey = 'text_size';

  TextSizeNotifier() : super(TextSize.normal) {
    _loadTextSize();
  }

  Future<void> _loadTextSize() async {
    final prefs = await SharedPreferences.getInstance();
    final textSizeString = prefs.getString(_textSizeKey);
    
    if (textSizeString != null) {
      state = TextSize.values.firstWhere(
        (e) => e.name == textSizeString,
        orElse: () => TextSize.normal,
      );
    }
  }

  Future<void> setTextSize(TextSize size) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_textSizeKey, size.name);
    state = size;
  }
}

final textSizeProvider =
    StateNotifierProvider<TextSizeNotifier, TextSize>((ref) {
  return TextSizeNotifier();
});
