import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_fr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('fr'),
  ];

  /// No description provided for @activity_tracking.
  ///
  /// In en, this message translates to:
  /// **'Activity Tracking'**
  String get activity_tracking;

  /// No description provided for @activity_tracking_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Track your daily activities and your progress over time.'**
  String get activity_tracking_subtitle;

  /// No description provided for @birthdate_hint.
  ///
  /// In en, this message translates to:
  /// **'Birthdate'**
  String get birthdate_hint;

  /// No description provided for @cal_friday.
  ///
  /// In en, this message translates to:
  /// **'Friday'**
  String get cal_friday;

  /// No description provided for @cal_monday.
  ///
  /// In en, this message translates to:
  /// **'Monday'**
  String get cal_monday;

  /// No description provided for @cal_saturday.
  ///
  /// In en, this message translates to:
  /// **'Saturday'**
  String get cal_saturday;

  /// No description provided for @cal_sunday.
  ///
  /// In en, this message translates to:
  /// **'Sunday'**
  String get cal_sunday;

  /// No description provided for @cal_thursday.
  ///
  /// In en, this message translates to:
  /// **'Thursday'**
  String get cal_thursday;

  /// No description provided for @cal_tuesday.
  ///
  /// In en, this message translates to:
  /// **'Tuesday'**
  String get cal_tuesday;

  /// No description provided for @cal_wednesday.
  ///
  /// In en, this message translates to:
  /// **'Wednesday'**
  String get cal_wednesday;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @capture_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Take a photo or a short video to allow verification.'**
  String get capture_subtitle;

  /// No description provided for @capture_title.
  ///
  /// In en, this message translates to:
  /// **'Verification'**
  String get capture_title;

  /// No description provided for @changes_canceled.
  ///
  /// In en, this message translates to:
  /// **'Changes canceled'**
  String get changes_canceled;

  /// No description provided for @changes_saved.
  ///
  /// In en, this message translates to:
  /// **'Changes saved'**
  String get changes_saved;

  /// No description provided for @appearance.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get appearance;

  /// No description provided for @theme_light.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get theme_light;

  /// No description provided for @theme_dark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get theme_dark;

  /// No description provided for @theme_auto.
  ///
  /// In en, this message translates to:
  /// **'Auto'**
  String get theme_auto;

  /// No description provided for @email_hint.
  ///
  /// In en, this message translates to:
  /// **'john.doe@email.com'**
  String get email_hint;

  /// No description provided for @forgot_password.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get forgot_password;

  /// No description provided for @login_button.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get login_button;

  /// No description provided for @login_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Log in to your account'**
  String get login_subtitle;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// No description provided for @manage_profil.
  ///
  /// In en, this message translates to:
  /// **'Manage your profile and personal information.'**
  String get manage_profil;

  /// No description provided for @name_hint.
  ///
  /// In en, this message translates to:
  /// **'John Doe'**
  String get name_hint;

  /// No description provided for @no_account_yet.
  ///
  /// In en, this message translates to:
  /// **'Don\'t have an account yet?'**
  String get no_account_yet;

  /// No description provided for @notifications.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// No description provided for @or_connect_with.
  ///
  /// In en, this message translates to:
  /// **'Or connect with'**
  String get or_connect_with;

  /// No description provided for @password_hint.
  ///
  /// In en, this message translates to:
  /// **'********'**
  String get password_hint;

  /// No description provided for @photo_taken.
  ///
  /// In en, this message translates to:
  /// **'Photo saved'**
  String get photo_taken;

  /// No description provided for @branding.
  ///
  /// In en, this message translates to:
  /// **'AI Calendar Converter'**
  String get branding;

  /// No description provided for @branding_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Upload images of your appointments, and AI turns them into calendar-ready events.\nNo registration – simple Google login, 100% free.'**
  String get branding_subtitle;

  /// No description provided for @preferred_language.
  ///
  /// In en, this message translates to:
  /// **'Preferred language'**
  String get preferred_language;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @save.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get save;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @settings_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Modify your settings and personalize your experience.'**
  String get settings_subtitle;

  /// No description provided for @sign_up.
  ///
  /// In en, this message translates to:
  /// **'Sign up'**
  String get sign_up;

  /// No description provided for @take_photo.
  ///
  /// In en, this message translates to:
  /// **'Photo'**
  String get take_photo;

  /// No description provided for @take_video.
  ///
  /// In en, this message translates to:
  /// **'Video'**
  String get take_video;

  /// No description provided for @video_taken.
  ///
  /// In en, this message translates to:
  /// **'Take a video'**
  String get video_taken;

  /// No description provided for @welcome.
  ///
  /// In en, this message translates to:
  /// **'Hello, happy to see you again!'**
  String get welcome;

  /// No description provided for @create_account.
  ///
  /// In en, this message translates to:
  /// **'Create your account'**
  String get create_account;

  /// No description provided for @register_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Please fill in the details below to create a new account.'**
  String get register_subtitle;

  /// No description provided for @already_have_account.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? Sign in'**
  String get already_have_account;

  /// No description provided for @error_saving_data.
  ///
  /// In en, this message translates to:
  /// **'error_saving_data'**
  String get error_saving_data;

  /// No description provided for @delete_account.
  ///
  /// In en, this message translates to:
  /// **'Delete my account'**
  String get delete_account;

  /// No description provided for @confirm_delete_account.
  ///
  /// In en, this message translates to:
  /// **'Are you sure you want to delete your account? This action cannot be undone.'**
  String get confirm_delete_account;

  /// No description provided for @confirm.
  ///
  /// In en, this message translates to:
  /// **'Confirmation'**
  String get confirm;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @error_occurred.
  ///
  /// In en, this message translates to:
  /// **'An error occurred'**
  String get error_occurred;

  /// No description provided for @app_tagline.
  ///
  /// In en, this message translates to:
  /// **'Your Health Companion'**
  String get app_tagline;

  /// No description provided for @enabled.
  ///
  /// In en, this message translates to:
  /// **'Enabled'**
  String get enabled;

  /// No description provided for @disabled.
  ///
  /// In en, this message translates to:
  /// **'Disabled'**
  String get disabled;

  /// No description provided for @upcoming_reminders.
  ///
  /// In en, this message translates to:
  /// **'Upcoming Reminders'**
  String get upcoming_reminders;

  /// No description provided for @less.
  ///
  /// In en, this message translates to:
  /// **'Less'**
  String get less;

  /// No description provided for @more.
  ///
  /// In en, this message translates to:
  /// **'More'**
  String get more;

  /// No description provided for @powering_productivity.
  ///
  /// In en, this message translates to:
  /// **'Powering Productivity'**
  String get powering_productivity;

  /// No description provided for @pre_events_generated.
  ///
  /// In en, this message translates to:
  /// **'over '**
  String get pre_events_generated;

  /// No description provided for @events_generated.
  ///
  /// In en, this message translates to:
  /// **'Events Generated from '**
  String get events_generated;

  /// No description provided for @images.
  ///
  /// In en, this message translates to:
  /// **'images'**
  String get images;

  /// No description provided for @pre_hours_saved.
  ///
  /// In en, this message translates to:
  /// **'That\'s '**
  String get pre_hours_saved;

  /// No description provided for @hours_saved.
  ///
  /// In en, this message translates to:
  /// **'Hours Saved'**
  String get hours_saved;

  /// No description provided for @workdays_saved.
  ///
  /// In en, this message translates to:
  /// **'Workdays Saved'**
  String get workdays_saved;

  /// No description provided for @get_started.
  ///
  /// In en, this message translates to:
  /// **'Get Started'**
  String get get_started;

  /// No description provided for @converter_title.
  ///
  /// In en, this message translates to:
  /// **'Convert Files'**
  String get converter_title;

  /// No description provided for @converter_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Upload photos or PDFs of appointments and schedules to extract calendar events.'**
  String get converter_subtitle;

  /// No description provided for @convert_button.
  ///
  /// In en, this message translates to:
  /// **'Convert to Calendar Events'**
  String get convert_button;

  /// No description provided for @extracted_events.
  ///
  /// In en, this message translates to:
  /// **'Extracted Events'**
  String get extracted_events;

  /// No description provided for @download_ics.
  ///
  /// In en, this message translates to:
  /// **'Download ICS File'**
  String get download_ics;

  /// No description provided for @no_events_found.
  ///
  /// In en, this message translates to:
  /// **'No events found in files'**
  String get no_events_found;

  /// No description provided for @processing_images.
  ///
  /// In en, this message translates to:
  /// **'Processing files...'**
  String get processing_images;

  /// No description provided for @upload_images.
  ///
  /// In en, this message translates to:
  /// **'Tap to upload images'**
  String get upload_images;

  /// No description provided for @upload_files.
  ///
  /// In en, this message translates to:
  /// **'Tap to upload files'**
  String get upload_files;

  /// No description provided for @upload_hint.
  ///
  /// In en, this message translates to:
  /// **'Upload photos or PDFs of appointments or schedules'**
  String get upload_hint;

  /// No description provided for @supported_formats.
  ///
  /// In en, this message translates to:
  /// **'Supports: JPG, PNG, WEBP, PDF'**
  String get supported_formats;

  /// No description provided for @images_selected.
  ///
  /// In en, this message translates to:
  /// **'images selected'**
  String get images_selected;

  /// No description provided for @clear_all.
  ///
  /// In en, this message translates to:
  /// **'Clear all'**
  String get clear_all;

  /// No description provided for @ics_generated.
  ///
  /// In en, this message translates to:
  /// **'ICS file generated! Ready to download.'**
  String get ics_generated;

  /// No description provided for @save_ics_file.
  ///
  /// In en, this message translates to:
  /// **'Save ICS File'**
  String get save_ics_file;

  /// No description provided for @save_to_downloads.
  ///
  /// In en, this message translates to:
  /// **'Save to downloads folder'**
  String get save_to_downloads;

  /// No description provided for @copy_to_clipboard.
  ///
  /// In en, this message translates to:
  /// **'Copy to Clipboard'**
  String get copy_to_clipboard;

  /// No description provided for @copy_ics_hint.
  ///
  /// In en, this message translates to:
  /// **'Copy ICS content to paste elsewhere'**
  String get copy_ics_hint;

  /// No description provided for @preview_ics.
  ///
  /// In en, this message translates to:
  /// **'Preview ICS'**
  String get preview_ics;

  /// No description provided for @preview_ics_hint.
  ///
  /// In en, this message translates to:
  /// **'View the generated ICS content'**
  String get preview_ics_hint;

  /// No description provided for @file_saved.
  ///
  /// In en, this message translates to:
  /// **'File Saved'**
  String get file_saved;

  /// No description provided for @file_saved_message.
  ///
  /// In en, this message translates to:
  /// **'ICS file saved. Would you like to open it?'**
  String get file_saved_message;

  /// No description provided for @no.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get no;

  /// No description provided for @open.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get open;

  /// No description provided for @download_started.
  ///
  /// In en, this message translates to:
  /// **'Download started!'**
  String get download_started;

  /// No description provided for @error_saving_file.
  ///
  /// In en, this message translates to:
  /// **'Error saving file'**
  String get error_saving_file;

  /// No description provided for @ics_copied.
  ///
  /// In en, this message translates to:
  /// **'ICS content copied to clipboard!'**
  String get ics_copied;

  /// No description provided for @generated_ics_file.
  ///
  /// In en, this message translates to:
  /// **'Generated ICS File'**
  String get generated_ics_file;

  /// No description provided for @copy.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get copy;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @please_upload_image.
  ///
  /// In en, this message translates to:
  /// **'Please upload at least one file'**
  String get please_upload_image;

  /// No description provided for @found_events.
  ///
  /// In en, this message translates to:
  /// **'Found {count} events!'**
  String found_events(int count);

  /// No description provided for @no_events_to_export.
  ///
  /// In en, this message translates to:
  /// **'No events to export'**
  String get no_events_to_export;

  /// No description provided for @error_processing_images.
  ///
  /// In en, this message translates to:
  /// **'Error processing files'**
  String get error_processing_images;

  /// No description provided for @error_exporting_ics.
  ///
  /// In en, this message translates to:
  /// **'Error exporting ICS'**
  String get error_exporting_ics;

  /// No description provided for @max_images_allowed.
  ///
  /// In en, this message translates to:
  /// **'Maximum {count} files allowed'**
  String max_images_allowed(int count);

  /// No description provided for @max_files_allowed.
  ///
  /// In en, this message translates to:
  /// **'Maximum {count} files allowed'**
  String max_files_allowed(int count);

  /// No description provided for @files_selected.
  ///
  /// In en, this message translates to:
  /// **'{count} file(s) selected'**
  String files_selected(int count);

  /// No description provided for @error_selecting_images.
  ///
  /// In en, this message translates to:
  /// **'Error selecting images'**
  String get error_selecting_images;

  /// No description provided for @error_selecting_files.
  ///
  /// In en, this message translates to:
  /// **'Error selecting files'**
  String get error_selecting_files;

  /// No description provided for @error_capturing_image.
  ///
  /// In en, this message translates to:
  /// **'Error capturing image'**
  String get error_capturing_image;

  /// No description provided for @ics_saved_to.
  ///
  /// In en, this message translates to:
  /// **'ICS saved to: {path}'**
  String ics_saved_to(String path);

  /// No description provided for @choose_image_source.
  ///
  /// In en, this message translates to:
  /// **'Choose Image Source'**
  String get choose_image_source;

  /// No description provided for @choose_file_source.
  ///
  /// In en, this message translates to:
  /// **'Choose File Source'**
  String get choose_file_source;

  /// No description provided for @camera.
  ///
  /// In en, this message translates to:
  /// **'Camera'**
  String get camera;

  /// No description provided for @gallery.
  ///
  /// In en, this message translates to:
  /// **'Gallery'**
  String get gallery;

  /// No description provided for @pdf_files.
  ///
  /// In en, this message translates to:
  /// **'PDF Files'**
  String get pdf_files;

  /// No description provided for @unknown_error.
  ///
  /// In en, this message translates to:
  /// **'Unknown error'**
  String get unknown_error;

  /// No description provided for @user_not_found.
  ///
  /// In en, this message translates to:
  /// **'User not found'**
  String get user_not_found;

  /// No description provided for @wrong_password.
  ///
  /// In en, this message translates to:
  /// **'Incorrect password'**
  String get wrong_password;

  /// No description provided for @passwords_do_not_match.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match'**
  String get passwords_do_not_match;

  /// No description provided for @account_created.
  ///
  /// In en, this message translates to:
  /// **'Account created successfully!'**
  String get account_created;

  /// No description provided for @email_already_in_use.
  ///
  /// In en, this message translates to:
  /// **'This email is already in use.'**
  String get email_already_in_use;

  /// No description provided for @invalid_email.
  ///
  /// In en, this message translates to:
  /// **'Invalid email address.'**
  String get invalid_email;

  /// No description provided for @weak_password.
  ///
  /// In en, this message translates to:
  /// **'Password is too weak.'**
  String get weak_password;

  /// No description provided for @error.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get error;

  /// No description provided for @conversion_archive.
  ///
  /// In en, this message translates to:
  /// **'Conversion Archive'**
  String get conversion_archive;

  /// No description provided for @conversion_archive_subtitle.
  ///
  /// In en, this message translates to:
  /// **'View your conversion history'**
  String get conversion_archive_subtitle;

  /// No description provided for @no_conversions_yet.
  ///
  /// In en, this message translates to:
  /// **'No conversions yet'**
  String get no_conversions_yet;

  /// No description provided for @events_converted.
  ///
  /// In en, this message translates to:
  /// **'{count} events converted'**
  String events_converted(String count);

  /// No description provided for @view_archive.
  ///
  /// In en, this message translates to:
  /// **'View Archive'**
  String get view_archive;

  /// No description provided for @events.
  ///
  /// In en, this message translates to:
  /// **'Events'**
  String get events;

  /// No description provided for @preview.
  ///
  /// In en, this message translates to:
  /// **'Preview'**
  String get preview;

  /// No description provided for @no_conversions_on_date.
  ///
  /// In en, this message translates to:
  /// **'No conversions on {date}'**
  String no_conversions_on_date(String date);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'fr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'fr':
      return AppLocalizationsFr();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
