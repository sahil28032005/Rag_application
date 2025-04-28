class DocumentModel {
  final String id;
  final String filename;
  final String status;
  final DateTime uploadedAt;

  DocumentModel({
    required this.id,
    required this.filename,
    required this.status,
    required this.uploadedAt,
  });

  factory DocumentModel.fromJson(Map<String, dynamic> json) {
    return DocumentModel(
      id: json['id'],
      filename: json['filename'],
      status: json['status'],
      uploadedAt: DateTime.parse(json['uploadedAt']),
    );
  }
}