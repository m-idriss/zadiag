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

  /// No description provided for @dark_mode.
  ///
  /// In en, this message translates to:
  /// **'Dark Mode'**
  String get dark_mode;

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
  /// **'Take a photo'**
  String get photo_taken;

  /// No description provided for @planning.
  ///
  /// In en, this message translates to:
  /// **'Planning'**
  String get planning;

  /// No description provided for @planning_subtitle.
  ///
  /// In en, this message translates to:
  /// **'Manage your notifications and reminder scheduling.'**
  String get planning_subtitle;

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
