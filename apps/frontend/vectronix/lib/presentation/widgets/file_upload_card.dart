import 'dart:io';
import 'package:flutter/material.dart';

class FileUploadCard extends StatelessWidget {
  final File? selectedFile;
  final bool isUploading;
  final double uploadProgress;
  final VoidCallback onPickFile;
  final VoidCallback onUploadFile;
  final VoidCallback? onClearFile;

  const FileUploadCard({
    super.key,
    required this.selectedFile,
    required this.isUploading,
    this.uploadProgress = 0.0,
    required this.onPickFile,
    required this.onUploadFile,
    this.onClearFile,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.upload_file,
              size: 72,
              color: colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text(
              'Upload Documents',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              'Upload PDF, DOCX, or TXT files to search and analyze',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            if (selectedFile != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.description,
                      color: colorScheme.onPrimaryContainer,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        selectedFile!.path.split('/').last,
                        style: TextStyle(
                          color: colorScheme.onPrimaryContainer,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (onClearFile != null)
                      IconButton(
                        icon: Icon(
                          Icons.close,
                          color: colorScheme.onPrimaryContainer,
                        ),
                        onPressed: onClearFile,
                      ),
                  ],
                ),
              ),
              if (isUploading) ...[
                const SizedBox(height: 16),
                LinearProgressIndicator(
                  value: uploadProgress > 0 ? uploadProgress / 100 : null,
                  backgroundColor: colorScheme.surfaceVariant,
                  valueColor: AlwaysStoppedAnimation<Color>(colorScheme.primary),
                ),
              ],
              const SizedBox(height: 16),
            ],
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ElevatedButton.icon(
                  onPressed: isUploading ? null : onPickFile,
                  icon: const Icon(Icons.file_open),
                  label: const Text('Select File'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colorScheme.secondaryContainer,
                    foregroundColor: colorScheme.onSecondaryContainer,
                  ),
                ),
                const SizedBox(width: 16),
                ElevatedButton.icon(
                  onPressed: (isUploading || selectedFile == null) ? null : onUploadFile,
                  icon: isUploading
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.cloud_upload),
                  label: Text(isUploading ? 'Uploading...' : 'Upload'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colorScheme.primaryContainer,
                    foregroundColor: colorScheme.onPrimaryContainer,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}