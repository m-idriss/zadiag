import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zadiag/shared/components/btm_nav_item.dart';

import 'package:zadiag/features/diag/screens/settings_screen.dart';
import 'package:zadiag/shared/models/menu.dart';
import 'package:zadiag/shared/models/rive_utils.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/constants/app_theme.dart';

import '../converter/converter_page.dart';
import 'providers/bottom_nav_provider.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> animation;

  // Page indices for navigation
  static const int _converterPageIndex = 0;

  List<Widget> get _pages => [const ConverterPage(), const SettingsScreen()];

  Menu selectedBottonNav = bottomNavItems[0];
  int _previousIndex = _converterPageIndex;

  void updateSelectedBtmNav(Menu menu) {
    if (selectedBottonNav != menu) {
      setState(() {
        _previousIndex = bottomNavItems.indexOf(selectedBottonNav);
        selectedBottonNav = menu;
      });
      // Update provider to keep it in sync
      ref.read(bottomNavProvider.notifier).selectPage(menu);
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
    // Listen to provider changes and sync with local state
    ref.listen<Menu>(bottomNavProvider, (previous, next) {
      if (selectedBottonNav != next) {
        setState(() {
          _previousIndex = bottomNavItems.indexOf(selectedBottonNav);
          selectedBottonNav = next;
        });
      }
    });

    final currentIndex = bottomNavItems.indexOf(selectedBottonNav);

    return Scaffold(
      extendBody: true,
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          AnimatedSwitcher(
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

          // Gradient and Blur behind bottom menu
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: 120,
            child: IgnorePointer(
              child: Stack(
                children: [
                  // Blur effect
                  ClipRect(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 3.0, sigmaY: 3.0),
                      child: Container(color: Colors.transparent),
                    ),
                  ),
                  // Gradient effect
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Theme.of(
                            context,
                          ).colorScheme.surface.withValues(alpha: 0.0),
                          Theme.of(
                            context,
                          ).colorScheme.surface.withValues(alpha: 0.8),
                          Theme.of(context).colorScheme.surface,
                        ],
                        stops: const [0.0, 0.6, 1.0],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: bottomNavBar(context),
    );
  }

  Widget bottomNavBar(BuildContext context) {
    return Container(
      color: Colors.transparent,
      margin: EdgeInsets.only(
        left: AppTheme.spacingLg,
        right: AppTheme.spacingLg,
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
