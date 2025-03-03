from flask import Flask, request, jsonify
from flask_cors import CORS
import easyocr
import os
import tempfile
import base64
import time
import json
import numpy as np
from werkzeug.utils import secure_filename
import functions_framework

# Custom JSON encoder to handle NumPy data types
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

app = Flask(__name__)
CORS(app)
app.json_encoder = NumpyEncoder

# Initialize EasyOCR
ocr = None
is_initialized = False

def initialize_ocr():
    global ocr, is_initialized
    if ocr is None:
        ocr = easyocr.Reader(['en'])
        is_initialized = True
        print('EasyOCR initialized successfully')

# Initialize OCR on startup
initialize_ocr()

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'ocrInitialized': is_initialized})

@app.route('/api/ocr', methods=['POST'])
def process_ocr():
    global is_initialized
    if not is_initialized:
        initialize_ocr()

    # Check if we have a file in the request
    if 'image' not in request.files and 'image' not in request.form:
        return jsonify({'error': 'No image provided. Send a file with field name "image" or a base64 encoded image in the request body.'}), 400

    try:
        image_path = None

        # Handle file upload
        if 'image' in request.files:
            file = request.files['image']
            image_path = os.path.join(tempfile.gettempdir(), secure_filename(file.filename))
            file.save(image_path)
        # Handle base64 image
        elif 'image' in request.form:
            base64_data = request.form['image'].split(',')[1]
            image_data = base64.b64decode(base64_data)
            image_path = os.path.join(tempfile.gettempdir(), f'image-{int(time.time())}.png')
            with open(image_path, 'wb') as f:
                f.write(image_data)

        print(f'Processing image: {image_path}')
        result = ocr.readtext(image_path)

        # Format the result to match the expected format in the frontend
        formatted_result = {
            'text': ' '.join([item[1] for item in result]),
            'words': [
                {
                    'text': item[1],
                    'bbox': {
                        'x0': int(min(item[0][0][0], item[0][3][0])),
                        'y0': int(min(item[0][0][1], item[0][1][1])),
                        'x1': int(max(item[0][1][0], item[0][2][0])),
                        'y1': int(max(item[0][2][1], item[0][3][1]))
                    }
                } for item in result
            ]
        }

        # Clean up the temporary file
        if image_path and os.path.exists(image_path):
            os.remove(image_path)

        return json.dumps(formatted_result, cls=NumpyEncoder), 200, {'Content-Type': 'application/json'}

    except Exception as error:
        print(f'OCR Error: {error}')
        return jsonify({'error': f'Failed to process image: {str(error)}'}), 500

@functions_framework.http
def hello_http(request):
    """HTTP Cloud Function.
    Args:
        request (flask.Request): The request object.
        <https://flask.palletsprojects.com/en/1.1.x/api/#incoming-request-data>
    Returns:
        The response text, or any set of values that can be turned into a
        Response object using `make_response`
        <https://flask.palletsprojects.com/en/1.1.x/api/#flask.make_response>.
    """
    request_json = request.get_json(silent=True)
    request_args = request.args

    if request_json and 'name' in request_json:
        name = request_json['name']
    elif request_args and 'name' in request_args:
        name = request_args['name']
    else:
        name = 'World'
    return 'Hello {}!'.format(name)

if __name__ == '__main__':
    app.run(debug=True)
