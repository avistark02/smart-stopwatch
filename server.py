from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import json
import os

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

STATUS_FILE = 'status.json'

def load_status():
    if os.path.exists(STATUS_FILE):
        with open(STATUS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_status(data):
    with open(STATUS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    print("Saved status:", data)  # Debug print

@app.route('/')
def home():
    return render_template('index.html')  # Serves from templates/index.html

@app.route('/status', methods=['POST'])
def update_status():
    data = request.get_json(force=True)
    if not data:
        return jsonify({'error': 'No JSON received'}), 400

    sensor_id = data.get('id')
    presence = data.get('Presence', 'inactive')

    status = load_status()
    status[sensor_id] = presence
    save_status(status)
    print(f"Updated status for {sensor_id}: {presence}")
    return '', 204

@app.route('/status/<sensor_id>', methods=['GET'])
def get_status(sensor_id):
    status = load_status()
    presence = status.get(sensor_id, 'inactive')
    return jsonify({'Presence': presence})

if __name__ == '__main__':
    app.run(port=5000, debug=True)
