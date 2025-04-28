import 'dart:io';
import 'package:vectronix/data/models/document_model.dart';
import 'package:vectronix/data/models/search_result_model.dart';

abstract class DocumentRepository {
  Future<DocumentModel> uploadDocument(File file);
  Future<List<SearchResultModel>> searchDocuments(String query, {int limit = 5});
}