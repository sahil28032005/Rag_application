import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vectronix/core/network/dio_client.dart';
import 'package:vectronix/data/datasources/document_api_service.dart';
import 'package:vectronix/data/models/document_model.dart';
import 'package:vectronix/data/models/search_result_model.dart';
import 'package:vectronix/data/repositories/document_repository_impl.dart';
import 'package:vectronix/domain/repositories/document_repository.dart';

// Providers
final dioClientProvider = Provider<DioClient>((ref) {
  return DioClient(baseUrl: 'https://d0ef-103-252-53-110.ngrok-free.app'); // Remove trailing slash
});

final documentApiServiceProvider = Provider<DocumentApiService>((ref) {
  final dioClient = ref.watch(dioClientProvider);
  return DocumentApiService(dioClient: dioClient);
});

final documentRepositoryProvider = Provider<DocumentRepository>((ref) {
  final apiService = ref.watch(documentApiServiceProvider);
  return DocumentRepositoryImpl(apiService: apiService);
});

// State notifiers
class DocumentUploadNotifier extends StateNotifier<AsyncValue<DocumentModel?>> {
  final DocumentRepository _repository;

  DocumentUploadNotifier(this._repository) : super(const AsyncValue.data(null));

  Future<void> uploadDocument(File file) async {
    state = const AsyncValue.loading();
    try {
      final document = await _repository.uploadDocument(file);
      state = AsyncValue.data(document);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }
}

class SearchResultsNotifier extends StateNotifier<AsyncValue<List<SearchResultModel>>> {
  final DocumentRepository _repository;

  SearchResultsNotifier(this._repository) : super(const AsyncValue.data([]));

  Future<void> searchDocuments(String query, {int limit = 5}) async {
    if (query.isEmpty) {
      state = const AsyncValue.data([]);
      return;
    }
    
    state = const AsyncValue.loading();
    try {
      final results = await _repository.searchDocuments(query, limit: limit);
      state = AsyncValue.data(results);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }
}

// Provider for document upload
final documentUploadProvider = StateNotifierProvider<DocumentUploadNotifier, AsyncValue<DocumentModel?>>((ref) {
  final repository = ref.watch(documentRepositoryProvider);
  return DocumentUploadNotifier(repository);
});

// Provider for search results
final searchResultsProvider = StateNotifierProvider<SearchResultsNotifier, AsyncValue<List<SearchResultModel>>>((ref) {
  final repository = ref.watch(documentRepositoryProvider);
  return SearchResultsNotifier(repository);
});