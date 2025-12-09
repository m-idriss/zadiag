import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:isar/isar.dart';
import 'package:zadiag/features/converter/models/conversion_history.dart';

import 'package:zadiag/core/services/isar_service.dart';
import 'package:zadiag/features/auth/models/user_profile.dart';

class UserService {
  final IsarService _isarService = IsarService();
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final FirebaseAuth _auth = FirebaseAuth.instance;

  Future<UserProfile?> getUserProfile() async {
    final user = _auth.currentUser;
    if (user == null) return null;

    try {
      final doc = await _firestore.collection('users').doc(user.uid).get();
      if (doc.exists && doc.data() != null) {
        return UserProfile.fromFirestore(doc.data()!, doc.id);
      }
      return null;
    } catch (e) {
      print('Error getting user profile: $e');
      return null;
    }
  }

  Future<void> updateUserProfile({
    String? username,
    String? email,
    DateTime? birthDate,
    String? language,
    String? themeMode,
  }) async {
    final user = _auth.currentUser;
    if (user == null) return;

    final userRef = _firestore.collection('users').doc(user.uid);
    final data = <String, dynamic>{};

    if (username != null) data['username'] = username;
    if (email != null) data['email'] = email;
    if (birthDate != null) data['birthDate'] = Timestamp.fromDate(birthDate);
    if (language != null) data['language'] = language;
    if (themeMode != null) data['themeMode'] = themeMode;

    try {
      await userRef.set(data, SetOptions(merge: true));
    } catch (e) {
      print('Error updating user profile: $e');
    }
  }

  Future<void> deleteUserAccount() async {
    final user = _auth.currentUser;
    if (user == null) return;

    try {
      // Delete user profile from Firestore
      await _firestore.collection('users').doc(user.uid).delete();

      // Delete user conversions from Isar (local)
      final isar = await _isarService.db;
      await isar.writeTxn(() async {
        await isar.conversionHistorys
            .where()
            .userIdEqualTo(user.uid)
            .deleteAll();
      });

      // Delete Firebase Auth user
      await user.delete();
    } catch (e) {
      print('Error deleting user account: $e');
      rethrow;
    }
  }
}
