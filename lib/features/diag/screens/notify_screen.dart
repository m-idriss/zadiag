import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:zadiag/core/constants/app_theme.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';

class NotifyScreen extends StatefulWidget {
  const NotifyScreen({super.key});

  @override
  State<NotifyScreen> createState() => _NotifyScreenState();
}

bool notificationsEnabled = true;

class _NotifyScreenState extends State<NotifyScreen> {
  final _formKey = GlobalKey<FormState>();

  @override
  Widget build(BuildContext context) {
    final defaultColorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        padding: const EdgeInsets.all(22),
        decoration: _background(defaultColorScheme),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              _header(context),
              const SizedBox(height: 12.0),
              _notficationButton(context),
            ],
          ),
        ),
      ),
    );
  }

  BoxDecoration _background(ColorScheme colorScheme) {
    return buildBackground(colorScheme);
  }

  Column _header(BuildContext context) {
    return buildHeader(
      context,
      trad(context)!.planning,
      trad(context)!.planning_subtitle,
    );
  }

  Row _notficationButton(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        Text(
          trad(context)!.notifications,
          style: TextStyle(
            fontFamily: AppTheme.defaultFontFamilyName,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        CupertinoSwitch(
          //activeTrackColor: Theme.of(context).colorScheme.primary,
          //thumbColor: Theme.of(context).colorScheme.tertiary,
          value: notificationsEnabled,
          onChanged: (value) {
            setState(() {
              notificationsEnabled = value;
            });
          },
        ),
      ],
    );
  }
}
