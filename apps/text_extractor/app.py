from flask import Flask, request, jsonify
import PyPDF2
import os
import numpy as np
from transformers import AutoTokenizer, AutoModel
import onnxruntime as ort
import urllib.request
import zipfile
import shutil

app = Flask(__name__)

# Model paths
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
ONNX_MODEL_PATH = os.path.join(MODEL_DIR, "model.onnx")

# Create model directory if it doesn't exist
os.makedirs(MODEL_DIR, exist_ok=True)

# Download and prepare the ONNX model if it doesn't exist
def download_onnx_model():
    if not os.path.exists(ONNX_MODEL_PATH):
        print("Downloading ONNX model...")
        # URL for a small, pre-converted ONNX model (MiniLM)
        url = "https://huggingface.co/optimum/all-MiniLM-L6-v2/resolve/main/model.onnx"
        urllib.request.urlretrieve(url, ONNX_MODEL_PATH)
        print("ONNX model downloaded successfully")

# Initialize tokenizer and ONNX session
tokenizer = None
ort_session = None

def initialize_model():
    global tokenizer, ort_session
    if tokenizer is None or ort_session is None:
        print("Initializing model...")
        # Download model if needed
        download_onnx_model()
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")
        
        # Create ONNX Runtime session
        ort_session = ort.InferenceSession(ONNX_MODEL_PATH)
        print("Model initialized successfully")

# Initialize model at startup
initialize_model()

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

@app.route('/embed', methods=['POST'])
def create_embedding():
    data = request.json
    text = data.get('text')
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    try:
        # Ensure model is initialized
        initialize_model()
        
        # Tokenize the text
        inputs = tokenizer(text, padding=True, truncation=True, return_tensors="np")
        
        # Run inference with ONNX Runtime
        outputs = ort_session.run(
            None, 
            {
                "input_ids": inputs["input_ids"],
                "attention_mask": inputs["attention_mask"],
                "token_type_ids": inputs.get("token_type_ids", np.zeros_like(inputs["input_ids"]))
            }
        )
        
        # Get embeddings from the last hidden state
        last_hidden_state = outputs[0]
        
        # Mean pooling to get sentence embedding
        input_mask_expanded = np.expand_dims(inputs["attention_mask"], axis=-1)
        embedding = np.sum(last_hidden_state * input_mask_expanded, axis=1) / np.sum(input_mask_expanded, axis=1)
        
        # Convert to list for JSON serialization
        embedding_list = embedding[0].tolist()
        
        # Return in a format similar to OpenAI for compatibility
        return jsonify({
            "data": [
                {
                    "embedding": embedding_list,
                    "index": 0,
                    "object": "embedding"
                }
            ],
            "model": "all-MiniLM-L6-v2-onnx",
            "object": "list"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)