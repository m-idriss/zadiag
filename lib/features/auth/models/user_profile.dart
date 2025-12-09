import 'package:cloud_firestore/cloud_firestore.dart';

class UserProfile {
  final String userId;
  String? username;
  String? email;
  DateTime? birthDate;
  String? language;
  String? themeMode; // "light", "dark", "system"

  UserProfile({
    required this.userId,
    this.username,
    this.email,
    this.birthDate,
    this.language,
    this.themeMode,
  });

  factory UserProfile.fromFirestore(Map<String, dynamic> data, String id) {
    return UserProfile(
      userId: id,
      username: data['username'] as String?,
      email: data['email'] as String?,
      birthDate:
          data['birthDate'] != null
              ? (data['birthDate'] as Timestamp).toDate()
              : null,
      language: data['language'] as String?,
      themeMode: data['themeMode'] as String?,
    );
  }

  Map<String, dynamic> toFirestore() {
    return {
      'username': username,
      'email': email,
      'birthDate': birthDate != null ? Timestamp.fromDate(birthDate!) : null,
      'language': language,
      'themeMode': themeMode,
    };
  }
}
