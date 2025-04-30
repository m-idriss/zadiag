import 'package:flutter/material.dart';
import 'package:zadiag/shared/components/btm_nav_item.dart';
import 'package:zadiag/features/diag/screens/capture_screen.dart';
import 'package:zadiag/features/diag/screens/profile_screen.dart';
import 'package:zadiag/features/diag/screens/heatmap_screen.dart';
import 'package:zadiag/features/diag/screens/notify_screen.dart';
import 'package:zadiag/features/diag/screens/settings_screen.dart';
import 'package:zadiag/shared/models/menu.dart';
import 'package:zadiag/shared/models/rive_utils.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<StatefulWidget> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> animation;

  final List<Widget> _pages = [
    ProfileScreen(),
    HeatMapScreen(),
    CaptureScreen(),
    NotifyScreen(),
    SettingsScreen(),
  ];

  Menu selectedBottonNav = bottomNavItems[2];

  void updateSelectedBtmNav(Menu menu) {
    if (selectedBottonNav != menu) {
      setState(() {
        selectedBottonNav = menu;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 300),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _controller.forward();
    });
    animation = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: _pages[bottomNavItems.indexOf(selectedBottonNav)],
      bottomNavigationBar: bottomNavBar(context),
    );
  }

  Transform bottomNavBar(BuildContext context) {
    return Transform.translate(
      offset: Offset(0, -50),
      child: SafeArea(
        bottom: false,
        child: Container(
          padding: const EdgeInsets.all(12),
          margin: const EdgeInsets.symmetric(horizontal: 24),
          decoration: bottomMenu(context),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ...List.generate(bottomNavItems.length, (index) {
                Menu navBar = bottomNavItems[index];
                return BtmNavItem(
                  navBar: navBar,
                  press: () {
                    RiveUtils.chnageSMIBoolState(navBar.rive.status!);
                    updateSelectedBtmNav(navBar);
                  },
                  riveOnInit: (artboard) {
                    navBar.rive.status = RiveUtils.getRiveInput(
                      artboard,
                      stateMachineName: navBar.rive.stateMachineName,
                    );
                  },
                  selectedNav: selectedBottonNav,
                );
              }),
            ],
          ),
        ),
      ),
    );
  }
}
