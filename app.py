from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import json
import os
import logging
import tempfile

from storage import (
    load_authorized_users,
    load_known_faces,
    remove_authorized_user,
    normalize_name,
    add_authorized_user,
    set_face_encoding,
)
from config import (
    LOG_LEVEL,
    LOG_FILE,
    SENSOR_ID,
    STATUS_FILE,
    SESSION_LOG_FILE,
)

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

status = {"Presence": "inactive", "who": None}
session_tracker = {}

def load_json(path):
    if not os.path.exists(path):
        return [] if path == SESSION_LOG_FILE else {}
    with open(path, encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return [] if path == SESSION_LOG_FILE else {}

def save_json(path, data):
    dir_name = os.path.dirname(os.path.abspath(path))
    if not os.path.exists(dir_name):
        os.makedirs(dir_name, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(dir=dir_name, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(temp_path, path)

def log_session(sensor_id, start, end):
    duration = int((end - start).total_seconds())
    entry = {
        "sensor_id": sensor_id,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "duration": duration,
    }
    log = load_json(SESSION_LOG_FILE)
    log.append(entry)
    save_json(SESSION_LOG_FILE, log)

def set_presence_status(presence: str, who: str = None):
    global status
    status = {"Presence": presence, "who": who}
    try:
        data = load_json(STATUS_FILE)
        data[str(SENSOR_ID)] = {"Presence": presence, "who": who}
        save_json(STATUS_FILE, data)
    except Exception as e:
        logger.error(f"Failed to persist status: {e}")

    now = datetime.now()
    sid = str(SENSOR_ID)
    if presence == "active":
        if sid not in session_tracker:
            session_tracker[sid] = now
    elif presence in ("inactive", "error"):
        if sid in session_tracker:
            log_session(sid, session_tracker.pop(sid), now)

@app.route("/api/status", methods=["GET"])
def get_all_status():
    return jsonify(load_json(STATUS_FILE))

@app.route("/api/session-log", methods=["GET"])
def get_session_log():
    return jsonify(load_json(SESSION_LOG_FILE))

@app.route("/api/session-log", methods=["DELETE"])
def delete_session_log():
    save_json(SESSION_LOG_FILE, [])
    return "", 204

@app.route("/api/authorized-users", methods=["GET"])
def get_authorized_users():
    return jsonify(load_authorized_users())

@app.route("/api/face-descriptors", methods=["GET"])
def get_face_descriptors():
    return jsonify(load_known_faces())

@app.route("/api/sync-presence", methods=["POST"])
def sync_presence():
    data = request.json or {}
    presence = data.get("presence", "inactive")
    who = data.get("who")
    set_presence_status(presence, who)
    return jsonify({"success": True})

@app.route("/api/enroll-photo", methods=["POST"])
def api_enroll_photo():
    data = request.json or {}
    name = normalize_name(data.get("name") or "")
    descriptor = data.get("descriptor")
    if not name or not descriptor:
        return jsonify({"success": False, "message": "Name and descriptor required"}), 400
    add_authorized_user(name)
    set_face_encoding(name, descriptor)
    return jsonify({"success": True, "message": f"Successfully enrolled {name}"})

@app.route("/api/remove-user", methods=["DELETE"])
def remove_user():
    data = request.json
    name = normalize_name(data.get("name") or "")
    if name:
        remove_authorized_user(name)
        return jsonify({"success": True})
    return jsonify({"success": False}), 400

@app.errorhandler(404)
def not_found(error):
    return jsonify({"success": False, "message": "Not found"}), 404

@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled Exception: {str(e)}", exc_info=True)
    return jsonify({"success": False, "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
