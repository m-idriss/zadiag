import 'package:isar/isar.dart';
import 'package:path_provider/path_provider.dart';
import 'package:zadiag/features/converter/models/conversion_history.dart';

class IsarService {
  static final IsarService _instance = IsarService._internal();
  late Future<Isar> db;

  factory IsarService() {
    return _instance;
  }

  IsarService._internal() {
    db = openDB();
  }

  Future<Isar> openDB() async {
    if (Isar.instanceNames.isEmpty) {
      final dir = await getApplicationDocumentsDirectory();
      return await Isar.open(
        [ConversionHistorySchema],
        directory: dir.path,
        inspector: true,
      );
    }
    return Future.value(Isar.getInstance());
  }
}
