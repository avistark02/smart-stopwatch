from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from datetime import datetime
import json, os

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

STATUS_FILE = 'status.json'
SESSION_LOG_FILE = 'session_log.json'
session_tracker = {}

# Utility: Load JSON safely
def load_json(path):
    if os.path.exists(path):
        with open(path, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return [] if path == SESSION_LOG_FILE else {}
    return [] if path == SESSION_LOG_FILE else {}

# Utility: Save JSON
def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

# Log a session entry
def log_session(sensor_id, start, end):
    duration = int((end - start).total_seconds())
    entry = {
        "sensor_id": sensor_id,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "duration": duration
    }
    log = load_json(SESSION_LOG_FILE)
    log.append(entry)
    save_json(SESSION_LOG_FILE, log)
    print("Logged:", entry)

# Home page
@app.route('/')
def home():
    return render_template('index.html')

# Update sensor status
@app.route('/status', methods=['POST'])
def update_status():
    data = request.get_json(force=True)
    status = load_json(STATUS_FILE)
    status.update(data)
    save_json(STATUS_FILE, status)

    now = datetime.now()
    for sensor_id, presence in data.items():
        if presence == "active":
            if sensor_id not in session_tracker:
                session_tracker[sensor_id] = now
        elif presence == "inactive":
            if sensor_id in session_tracker:
                log_session(sensor_id, session_tracker.pop(sensor_id), now)

    return '', 204

# Get current status for a sensor
@app.route('/status/<sensor_id>', methods=['GET'])
def get_status(sensor_id):
    status = load_json(STATUS_FILE)
    return jsonify({'Presence': status.get(sensor_id, 'inactive')})

# Get full session log
@app.route('/session-log', methods=['GET'])
def get_session_log():
    return jsonify(load_json(SESSION_LOG_FILE))

# Delete all session logs
@app.route('/delete-log', methods=['POST'])
def delete_session_log():
    save_json(SESSION_LOG_FILE, [])
    print("Session log cleared.")
    return '', 204

# Run the app
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
