from flask import Flask, request, jsonify
import PyPDF2
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "service": "text-extractor"}), 200
    
@app.route('/extract', methods=['POST'])
def extract_text():
    data = request.json
    filepath = data.get('filepath')
    
    if not filepath or not os.path.exists(filepath):
        return jsonify({"error": "File not found"}), 404
    
    try:
        # Extract text using PyPDF2
        text = ""
        with open(filepath, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page_num in range(len(reader.pages)):
                text += reader.pages[page_num].extract_text()
        
        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add embedding functionality
# You can choose between sentence-transformers or ONNX implementation
# Option 1: Using sentence-transformers (PyTorch)
from sentence_transformers import SentenceTransformer
import numpy as np

# Initialize the model - this will be loaded once when the app starts
model = None

def get_model():
    global model
    if model is None:
        print("Loading embedding model with sentence-transformers...")
        model = SentenceTransformer('paraphrase-MiniLM-L3-v2')  # Smaller, faster model
        print("Model loaded successfully")
    return model

@app.route('/embed', methods=['POST'])
def create_embedding():
    data = request.json
    
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400
    
    try:
        # Get the model
        model = get_model()
        
        # Generate embedding
        text = data['text']
        embedding = model.encode(text)
        
        # Convert to list and ensure it's JSON serializable
        embedding_list = embedding.tolist()
        
        return jsonify({
            'data': [{
                'embedding': embedding_list
            }],
            'dimensions': len(embedding_list),
            'model': 'sentence-transformers-MiniLM-L3-v2'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)