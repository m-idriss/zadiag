import 'package:flutter/material.dart';
import 'package:zadiag/shared/components/btm_nav_item.dart';
import 'package:zadiag/features/diag/screens/capture_screen.dart';
import 'package:zadiag/features/diag/screens/profile_screen.dart';
import 'package:zadiag/features/diag/screens/heatmap_screen.dart';
import 'package:zadiag/features/diag/screens/branding_screen.dart';
import 'package:zadiag/features/diag/screens/settings_screen.dart';
import 'package:zadiag/shared/models/menu.dart';
import 'package:zadiag/shared/models/rive_utils.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/constants/app_theme.dart';

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
    BrandingScreen(),
    HeatMapScreen(),
    CaptureScreen(),
    ProfileScreen(),
    SettingsScreen(),
  ];

  Menu selectedBottonNav = bottomNavItems[2];
  int _previousIndex = 2;

  void updateSelectedBtmNav(Menu menu) {
    if (selectedBottonNav != menu) {
      setState(() {
        _previousIndex = bottomNavItems.indexOf(selectedBottonNav);
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
    final currentIndex = bottomNavItems.indexOf(selectedBottonNav);
    
    return Scaffold(
      extendBody: true,
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        transitionBuilder: (Widget child, Animation<double> animation) {
          final slideDirection = currentIndex > _previousIndex ? 1.0 : -1.0;
          return SlideTransition(
            position: Tween<Offset>(
              begin: Offset(slideDirection * 0.1, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            )),
            child: FadeTransition(
              opacity: animation,
              child: child,
            ),
          );
        },
        child: KeyedSubtree(
          key: ValueKey<int>(currentIndex),
          child: _pages[currentIndex],
        ),
      ),
      bottomNavigationBar: bottomNavBar(context),
    );
  }

  Widget bottomNavBar(BuildContext context) {
    return Container(
      margin: EdgeInsets.only(
        left: AppTheme.spacingLg,
        right: AppTheme.spacingLg,
        bottom: AppTheme.spacingLg,
      ),
      child: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingMd,
            vertical: AppTheme.spacingSm,
          ),
          decoration: bottomMenu(context),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
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
