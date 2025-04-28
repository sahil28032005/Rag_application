class SearchResultModel {
  final String documentId;
  final String text;
  final double score;
  final Map<String, dynamic>? metadata;

  SearchResultModel({
    required this.documentId,
    required this.text,
    required this.score,
    this.metadata,
  });

  factory SearchResultModel.fromJson(Map<String, dynamic> json) {
    return SearchResultModel(
      documentId: json['documentId'],
      text: json['text'],
      score: json['score'].toDouble(),
      metadata: json['metadata'],
    );
  }
}