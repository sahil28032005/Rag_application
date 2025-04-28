import 'dart:io';
import 'package:vectronix/data/datasources/document_api_service.dart';
import 'package:vectronix/data/models/document_model.dart';
import 'package:vectronix/data/models/search_result_model.dart';
import 'package:vectronix/domain/repositories/document_repository.dart';

class DocumentRepositoryImpl implements DocumentRepository {
  final DocumentApiService _apiService;

  DocumentRepositoryImpl({required DocumentApiService apiService})
      : _apiService = apiService;

  @override
  Future<DocumentModel> uploadDocument(File file) async {
    try {
      final response = await _apiService.uploadDocument(file);
      return DocumentModel.fromJson(response);
    } catch (e) {
      rethrow;
    }
  }

  @override
  Future<List<SearchResultModel>> searchDocuments(String query, {int limit = 5}) async {
    try {
      final response = await _apiService.searchDocuments(query, limit: limit);
      final results = response['results'] as List;
      return results.map((result) => SearchResultModel.fromJson(result)).toList();
    } catch (e) {
      rethrow;
    }
  }
}