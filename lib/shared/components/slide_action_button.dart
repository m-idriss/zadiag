import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class SlideActionBtn extends StatefulWidget {
  final Future<void> Function() onConfirmation;
  final String text;
  final double height;
  final Color? backgroundColor;
  final Color? sliderButtonColor;
  final IconData sliderButtonIcon;
  final Color? sliderButtonIconColor;
  final TextStyle? textStyle;
  final double borderRadius;

  const SlideActionBtn({
    super.key,
    required this.onConfirmation,
    required this.text,
    this.height = 60,
    this.backgroundColor,
    this.sliderButtonColor,
    this.sliderButtonIcon = Icons.arrow_forward_rounded,
    this.sliderButtonIconColor,
    this.textStyle,
    this.borderRadius = 12,
  });

  @override
  State<SlideActionBtn> createState() => _SlideActionBtnState();
}

class _SlideActionBtnState extends State<SlideActionBtn> {
  double _position = 0;
  bool _isDragging = false;
  bool _isConfirmed = false;
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final effectiveBackgroundColor =
        widget.backgroundColor ?? colorScheme.error.withValues(alpha: 0.1);
    final effectiveSliderColor = widget.sliderButtonColor ?? colorScheme.error;
    final effectiveIconColor =
        widget.sliderButtonIconColor ?? colorScheme.onError;

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth;
        final sliderWidth = widget.height - 8; // Padding 4 on each side

        return Container(
          height: widget.height,
          decoration: BoxDecoration(
            color: effectiveBackgroundColor,
            borderRadius: BorderRadius.circular(widget.borderRadius),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              // Default Text
              Center(
                child: Opacity(
                  opacity: (1 - (_position / (maxWidth - widget.height))).clamp(
                    0.0,
                    1.0,
                  ),
                  child: Text(
                    widget.text,
                    style:
                        widget.textStyle ??
                        TextStyle(
                          color: colorScheme.error,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                  ),
                ),
              ),

              // Loading Indicator
              if (_isLoading)
                Center(
                  child: CircularProgressIndicator(color: effectiveSliderColor),
                ),

              // Slider
              if (!_isLoading && !_isConfirmed)
                AnimatedPositioned(
                  duration:
                      _isDragging
                          ? Duration.zero
                          : const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  left: _position,
                  top: 4,
                  bottom: 4,
                  child: GestureDetector(
                    onHorizontalDragStart: (details) {
                      setState(() {
                        _isDragging = true;
                      });
                    },
                    onHorizontalDragUpdate: (details) {
                      setState(() {
                        // Clamp position between 0 and max width - button width
                        _position = (_position + details.delta.dx).clamp(
                          0.5, // nice gap
                          maxWidth - widget.height + 4, // account for padding
                        );
                      });
                    },
                    onHorizontalDragEnd: (details) async {
                      final threshold =
                          maxWidth - widget.height - 20; // almost at the end

                      if (_position >= threshold) {
                        // Confirmed
                        setState(() {
                          _isDragging = false;
                          _position = maxWidth - widget.height + 4;
                          _isLoading = true;
                        });

                        HapticFeedback.heavyImpact();

                        try {
                          await widget.onConfirmation();
                          setState(() {
                            _isConfirmed = true;
                          });
                          // Short delay then reset
                          await Future.delayed(
                            const Duration(milliseconds: 1500),
                          );
                          if (mounted) {
                            setState(() {
                              _isConfirmed = false;
                              _isLoading = false;
                              _position = 0;
                            });
                          }
                        } catch (e) {
                          // Error state
                          HapticFeedback.vibrate();
                          if (mounted) {
                            setState(() {
                              _isLoading = false;
                              _position = 0;
                            });
                          }
                        }
                      } else {
                        // Reset
                        setState(() {
                          _isDragging = false;
                          _position = 0;
                        });
                      }
                    },
                    child: Container(
                      width: sliderWidth,
                      decoration: BoxDecoration(
                        color: effectiveSliderColor,
                        borderRadius: BorderRadius.circular(
                          widget.borderRadius - 4,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.2),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Icon(
                        widget.sliderButtonIcon,
                        color: effectiveIconColor,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
