import 'dart:io';
import 'package:dio/dio.dart';
import 'package:vectronix/core/network/dio_client.dart';

class DocumentApiService {
  final DioClient _dioClient;

  DocumentApiService({required DioClient dioClient}) : _dioClient = dioClient;

  Future<Map<String, dynamic>> uploadDocument(File file) async {
    print("inside api service uploader");
    print("File path: ${file.path}");
    print("File exists: ${file.existsSync()}");
    
    try {
      print("Creating form data");
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          file.path,
          filename: file.path.split('/').last,
        ),
      });
      print("Form data created successfully");

      print("Attempting to call API at /api/upload");
      final response = await _dioClient.postFormData(
        '/api/upload',
        formData: formData,
        onSendProgress: (sent, total) {
          // You can use this to track upload progress
          final progress = (sent / total) * 100;
          print('Upload progress: $progress%');
        },
      );
      print("response from api service ${response.data}");
      return response.data;
    } catch (e) {
      print("Error in uploadDocument: $e");
      rethrow;
    }
  }

  Future<Map<String, dynamic>> searchDocuments(String query, {int limit = 5}) async {
    try {
      print('sending request with query ${query}');
      final response = await _dioClient.post(
        '/api/search',
        data: {
          'query': query,
          'limit': limit,
        },
      );

      return response.data;
    } catch (e) {
      rethrow;
    }
  }
}