import 'package:flutter/material.dart';
import 'package:zadiag/core/utils/ui_helpers.dart';
import 'package:zadiag/core/utils/translate.dart';

class CaptureScreen extends StatelessWidget {
  const CaptureScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        padding: const EdgeInsets.all(22),
        decoration: _background(colorScheme),
        child: ListView(
          children: [
            _header(context),
            const SizedBox(height: 12),
            _cameraView(colorScheme),
            const SizedBox(height: 32),
            Row(
              children: [
                const SizedBox(width: 32),
                _takePhotoButton(context),
                const SizedBox(width: 60),
                _takeVideButton(context),
              ],
            ),
          ],
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
      trad(context)!.capture_title,
      trad(context)!.capture_subtitle,
    );
  }

  Container _cameraView(ColorScheme colorScheme) {
    return Container(
      height: 300,
      decoration: BoxDecoration(
        color: colorScheme.primary.withAlpha(50),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.primary),
      ),
      child: Center(
        child: Icon(
          Icons.camera_alt_outlined,
          size: 64,
          color: colorScheme.primary,
        ),
      ),
    );
  }

  Widget _takePhotoButton(BuildContext context) {
    return buildSettingsButton(
      context,
      trad(context)!.take_photo,
      Icons.photo_camera,
      () => showSnackBar(context, trad(context)!.photo_taken),
    );
  }

  Widget _takeVideButton(BuildContext context) {
    return buildSettingsButton(
      context,
      trad(context)!.take_video,
      Icons.videocam,
      () => showSnackBar(context, trad(context)!.video_taken),
    );
  }
}
