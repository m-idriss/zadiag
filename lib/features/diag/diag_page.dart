import 'package:flutter/material.dart';
import 'package:zadiag/shared/components/btm_nav_item.dart';
import 'package:zadiag/features/diag/screens/profile_screen.dart';
import 'package:zadiag/features/diag/screens/heatmap_screen.dart';
import 'package:zadiag/features/diag/screens/settings_screen.dart';
import 'package:zadiag/shared/models/menu.dart';
import 'package:zadiag/shared/models/rive_utils.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';
import 'package:zadiag/core/constants/app_theme.dart';

import '../converter/converter_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<StatefulWidget> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> animation;

  // Page indices for navigation
  static const int _converterPageIndex = 1;

  List<Widget> get _pages => [
    const ProfileScreen(),
    const ConverterPage(),
    const HeatMapScreen(),
    const SettingsScreen(),
  ];

  // Labels for bottom navigation items
  List<String> _getNavLabels(BuildContext context) => [
    trad(context)!.profile,
    trad(context)!.converter_title,
    trad(context)!.activity_tracking,
    trad(context)!.settings,
  ];

  Menu selectedBottonNav = bottomNavItems[_converterPageIndex];
  int _previousIndex = _converterPageIndex;

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
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      extendBody: false,
      backgroundColor: colorScheme.surface,
      body: Container(
        decoration: buildBackground(colorScheme),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 300),
          transitionBuilder: (Widget child, Animation<double> animation) {
            final slideDirection = currentIndex > _previousIndex ? 1.0 : -1.0;
            return SlideTransition(
              position: Tween<Offset>(
                begin: Offset(slideDirection * 0.1, 0),
                end: Offset.zero,
              ).animate(
                CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeOutCubic,
                ),
              ),
              child: FadeTransition(opacity: animation, child: child),
            );
          },
          child: KeyedSubtree(
            key: ValueKey<int>(currentIndex),
            child: _pages[currentIndex],
          ),
        ),
      ),
      bottomNavigationBar: _buildClassicBottomNavBar(context),
    );
  }

  Widget _buildClassicBottomNavBar(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final navLabels = _getNavLabels(context);
    
    return Container(
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border(
          top: BorderSide(
            color: colorScheme.outline.withValues(alpha: 0.2),
            width: 1,
          ),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppTheme.spacingSm,
            vertical: AppTheme.spacingXs,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              ...List.generate(bottomNavItems.length, (index) {
                Menu navBar = bottomNavItems[index];
                return BtmNavItem(
                  navBar: navBar,
                  label: navLabels[index],
                  press: () {
                    RiveUtils.changeSMIBoolState(navBar.rive.status!);
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
