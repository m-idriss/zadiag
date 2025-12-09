import 'rive_model.dart';
import 'package:rive_animated_icon/rive_animated_icon.dart';

class Menu {
  final String title;
  final RiveModel rive;

  Menu({required this.title, required this.rive});
}

List<Menu> bottomNavItems = [
  riveMenuButton(RiveIcon.timer),
  riveMenuButton(RiveIcon.add),
  riveMenuButton(RiveIcon.settings),
];

Menu riveMenuButton(RiveIcon icon) {
  return Menu(
    title: icon.name,
    rive: RiveModel(
      src: icon.getRiveAsset().src,
      artboard: icon.getRiveAsset().artboard,
      stateMachineName:
          icon.getRiveAsset().stateMachineName ?? "defaultStateMachineName",
    ),
  );
}
