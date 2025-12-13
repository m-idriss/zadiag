import 'package:flutter/material.dart';

class GlassScaffold extends StatelessWidget {
  final Widget body;
  final Widget? bottomNavigationBar;
  final bool extendBody;

  const GlassScaffold({
    super.key,
    required this.body,
    this.bottomNavigationBar,
    this.extendBody = true,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      extendBody: extendBody,
      backgroundColor: colorScheme.tertiary,
      body: body,
      bottomNavigationBar: bottomNavigationBar,
    );
  }
}
