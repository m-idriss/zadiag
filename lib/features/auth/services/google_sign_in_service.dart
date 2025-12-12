import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter/foundation.dart';
import 'package:zadiag/core/services/log_service.dart';

/// Service for handling Google Sign-In authentication.
/// 
/// This service integrates with Firebase Authentication to provide
/// Google sign-in functionality using the google_sign_in package.
class GoogleSignInService {
  final GoogleSignIn _googleSignIn = GoogleSignIn();
  final FirebaseAuth _auth = FirebaseAuth.instance;

  /// Signs in the user with Google.
  /// 
  /// Returns the [User] if successful, null otherwise.
  /// Throws exceptions on error.
  Future<User?> signInWithGoogle() async {
    try {
      Log.i('GoogleSignInService: Starting Google sign-in flow');

      // Trigger the authentication flow
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();

      if (googleUser == null) {
        Log.i('GoogleSignInService: User cancelled the sign-in');
        return null;
      }

      Log.i('GoogleSignInService: Google sign-in successful for ${googleUser.email}');

      // Obtain the auth details from the request
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;

      // Create a new credential
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      // Sign in to Firebase with the Google credential
      final UserCredential userCredential = 
          await _auth.signInWithCredential(credential);

      Log.i('GoogleSignInService: Firebase sign-in successful for ${userCredential.user?.email}');

      return userCredential.user;
    } catch (e, stack) {
      if (kDebugMode) {
        print('GoogleSignInService: Error during Google sign-in: $e');
        print('Stack trace: $stack');
      }
      Log.e('GoogleSignInService: Error during Google sign-in', e, stack);
      rethrow;
    }
  }

  /// Signs out the user from Google and Firebase.
  Future<void> signOut() async {
    try {
      Log.i('GoogleSignInService: Signing out');
      await Future.wait([
        _googleSignIn.signOut(),
        _auth.signOut(),
      ]);
      Log.i('GoogleSignInService: Sign out successful');
    } catch (e, stack) {
      if (kDebugMode) {
        print('GoogleSignInService: Error during sign out: $e');
      }
      Log.e('GoogleSignInService: Error during sign out', e, stack);
      rethrow;
    }
  }
}
