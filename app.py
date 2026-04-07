from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from datetime import datetime
import json
import os
import webbrowser
import threading
import time
import logging
from werkzeug.utils import secure_filename
import tempfile

from detect_and_send import enroll_face, enroll_from_image
from storage import (
    load_authorized_users,
    load_known_faces,
    remove_authorized_user,
    normalize_name,
)
from config import (
    BUFFER_TIME,
    FACE_TOLERANCE,
    CAMERA_RETRY_INTERVAL,
    CAMERA_MAX_RETRIES,
    LOG_LEVEL,
    LOG_FILE,
    SENSOR_ID,
    STATUS_FILE,
    SESSION_LOG_FILE,
)

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(LOG_FILE), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

status_lock = threading.Lock()
session_lock = threading.Lock()
status = {"Presence": "inactive", "who": None}
selected_person = None
selected_person_lock = threading.Lock()
enrollment_active_event = threading.Event()

session_tracker = {}


def load_json(path):
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump([] if path == SESSION_LOG_FILE else {}, f)
    with open(path, encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return [] if path == SESSION_LOG_FILE else {}


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


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
    logging.info(f"Logged session: {entry}")


def set_presence_status(presence: str, who: str = None):
    """Update in-memory status, persist to status.json, and track session durations."""
    global status
    with status_lock:
        status = {"Presence": presence, "who": who}
        logger.debug(f"Status updated: {status}")
    try:
        data = load_json(STATUS_FILE)
        data[str(SENSOR_ID)] = {"Presence": presence, "who": who}
        save_json(STATUS_FILE, data)
    except Exception as e:
        logger.error(f"Failed to persist status: {e}")

    now = datetime.now()
    sid = str(SENSOR_ID)
    with session_lock:
        if presence == "active":
            if sid not in session_tracker:
                session_tracker[sid] = now
        elif presence in ("inactive", "error"):
            if sid in session_tracker:
                log_session(sid, session_tracker.pop(sid), now)


def get_selected_person() -> str:
    with selected_person_lock:
        return selected_person


def set_selected_person(person: str):
    global selected_person
    with selected_person_lock:
        selected_person = person
        logger.info(f"Selected person changed to: {person}")


def monitor_proximity():
    """Monitor camera for selected person presence with error recovery."""
    logger.info("Monitor thread started")
    try:
        import cv2

        logger.info("cv2 imported OK")
    except Exception as e:
        logger.error(f"Failed to import cv2: {e}")
        return
    try:
        import face_recognition

        logger.info("face_recognition imported OK")
    except ImportError as e:
        logger.error(f"face_recognition not available: {e}")
        return

    retry_count = 0

    while True:
        if enrollment_active_event.is_set():
            time.sleep(0.5)
            continue

        cap = None
        try:
            time.sleep(1)
            logger.info("Attempting to open camera...")
            cap = cv2.VideoCapture(0)

            if not cap.isOpened():
                retry_count += 1
                logger.warning(
                    f"Camera could not be opened, retry {retry_count}/{CAMERA_MAX_RETRIES}"
                )
                if retry_count >= CAMERA_MAX_RETRIES:
                    logger.error("Camera failed repeatedly. Is another app using it?")
                    set_presence_status("inactive")
                    retry_count = 0
                    time.sleep(10)
                else:
                    time.sleep(CAMERA_RETRY_INTERVAL)
                continue

            retry_count = 0
            logger.info("Camera opened successfully")
            last_detected = 0

            while True:
                if enrollment_active_event.is_set():
                    logger.info("Enrollment active, pausing monitor camera.")
                    break

                ret, frame = cap.read()
                if not ret or frame is None:
                    logger.warning("Failed to read frame, reconnecting")
                    break

                person = get_selected_person()
                if person is None:
                    set_presence_status("inactive")
                    time.sleep(0.5)
                    continue

                known_faces = load_known_faces()
                if person not in known_faces:
                    logger.warning(f"No encoding for '{person}' — please enroll first")
                    set_presence_status("inactive")
                    time.sleep(0.5)
                    continue

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                face_locations = face_recognition.face_locations(rgb)
                face_encodings = face_recognition.face_encodings(rgb, face_locations)

                if not face_locations:
                    now = time.time()
                    if now - last_detected > BUFFER_TIME:
                        set_presence_status("inactive")
                    time.sleep(0.5)
                    continue

                target_encoding = known_faces[person]
                authorized_present = False

                for face_encoding in face_encodings:
                    distance = face_recognition.face_distance(
                        [target_encoding], face_encoding
                    )[0]
                    logger.debug(
                        f"Face distance for '{person}': {distance:.3f} (threshold: {FACE_TOLERANCE})"
                    )
                    if distance < FACE_TOLERANCE:
                        authorized_present = True
                        break

                now = time.time()
                if authorized_present:
                    if now - last_detected > BUFFER_TIME:
                        set_presence_status("active", person)
                        logger.info(f"Authorized: {person} (detected)")
                    last_detected = now
                else:
                    if face_encodings:
                        set_presence_status("error", "unauthorized")
                        logger.warning(
                            f"Unauthorized face detected (expected: {person})"
                        )
                    last_detected = now

                time.sleep(0.5)

        except Exception as e:
            logger.error(f"Monitor thread error: {e}", exc_info=True)
            set_presence_status("inactive")
            time.sleep(CAMERA_RETRY_INTERVAL)
        finally:
            if cap is not None:
                cap.release()
                logger.info("Camera released")


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/status", methods=["GET"])
def get_status():
    with status_lock:
        return jsonify(status)


@app.route("/status", methods=["POST"])
def post_sensor_status():
    """External clients: JSON body with sensor keys or {id, Presence, who}."""
    data = request.get_json(force=True) or {}
    now = datetime.now()

    if "Presence" in data and "id" in data:
        sid = str(data["id"])
        pr = data["Presence"]
        who = data.get("who")
        file_data = load_json(STATUS_FILE)
        file_data[sid] = {"Presence": pr, "who": who}
        save_json(STATUS_FILE, file_data)
        if sid == str(SENSOR_ID):
            with status_lock:
                status["Presence"] = pr
                status["who"] = who
        with session_lock:
            if pr == "active":
                if sid not in session_tracker:
                    session_tracker[sid] = now
            elif pr == "inactive" and sid in session_tracker:
                log_session(sid, session_tracker.pop(sid), now)
        return "", 204

    file_data = load_json(STATUS_FILE)
    for sensor_id, presence in data.items():
        if isinstance(presence, dict):
            file_data[sensor_id] = presence
            pr = presence.get("Presence", "inactive")
            who = presence.get("who")
        else:
            pr = presence
            who = None
            file_data[sensor_id] = {"Presence": pr, "who": who}

        if str(sensor_id) == str(SENSOR_ID):
            with status_lock:
                status["Presence"] = pr
                status["who"] = who

        with session_lock:
            if pr == "active":
                if sensor_id not in session_tracker:
                    session_tracker[sensor_id] = now
            elif pr == "inactive" and sensor_id in session_tracker:
                log_session(sensor_id, session_tracker.pop(sensor_id), now)

    save_json(STATUS_FILE, file_data)
    return "", 204


@app.route("/status/<sensor_id>", methods=["GET"])
def get_status_by_id(sensor_id):
    with status_lock:
        if str(sensor_id) == str(SENSOR_ID):
            return jsonify(status)
    file_data = load_json(STATUS_FILE)
    entry = file_data.get(sensor_id) or file_data.get(str(sensor_id))
    if isinstance(entry, dict) and "Presence" in entry:
        return jsonify({"Presence": entry["Presence"], "who": entry.get("who")})
    if isinstance(entry, str):
        return jsonify({"Presence": entry, "who": None})
    return jsonify({"Presence": "inactive", "who": None})


@app.route("/session-log", methods=["GET"])
def get_session_log():
    return jsonify(load_json(SESSION_LOG_FILE))


@app.route("/delete-log", methods=["POST"])
def delete_session_log():
    save_json(SESSION_LOG_FILE, [])
    logging.info("Session log cleared.")
    return "", 204


@app.route("/authorized-users", methods=["GET"])
def get_authorized_users():
    users = load_authorized_users()
    return jsonify(users)


@app.route("/enroll", methods=["POST"])
def api_enroll():
    data = request.json
    name = normalize_name(data.get("name") or "")
    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400
        
    enrollment_active_event.set()
    time.sleep(1.0)  # Give monitor thread time to detect event and release camera
    try:
        success, message = enroll_face(name, timeout=30)
    except Exception as e:
        logger.error(f"Enrollment error for {name}: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        enrollment_active_event.clear()
        
    if not success:
        return jsonify({"success": False, "message": message}), 400
    logger.info(f"Successfully enrolled: {name}")
    return jsonify({"success": True, "message": message})


@app.route("/enroll-image", methods=["POST"])
def api_enroll_image():
    data = request.json
    name = normalize_name(data.get("name") or "")
    image_path = (data.get("image_path") or "").strip()
    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400
    if not image_path:
        return jsonify({"success": False, "message": "image_path is required"}), 400
    try:
        success, message = enroll_from_image(name, image_path)
    except Exception as e:
        logger.error(f"Image enrollment error for {name}: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    if not success:
        return jsonify({"success": False, "message": message}), 400
    return jsonify({"success": True, "message": message})


@app.route("/enroll-photo", methods=["POST"])
def api_enroll_photo():
    name = normalize_name(request.form.get("name") or "")
    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400
    f = request.files.get("photo")
    if not f or not f.filename:
        return jsonify({"success": False, "message": "photo file required"}), 400
    path = os.path.join(
        tempfile.gettempdir(), secure_filename(f.filename) or "upload.jpg"
    )
    f.save(path)
    try:
        success, message = enroll_from_image(name, path)
    except Exception as e:
        logger.error(f"Photo upload enrollment error for {name}: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        try:
            os.remove(path)
        except OSError:
            pass
    if not success:
        return jsonify({"success": False, "message": message}), 400
    return jsonify({"success": True, "message": message})


@app.route("/remove-user", methods=["POST"])
def remove_user():
    data = request.json
    name = normalize_name(data.get("name") or "")
    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400
    try:
        remove_authorized_user(name)
        if get_selected_person() == name:
            set_selected_person(None)
        logger.info(f"Removed user: {name}")
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Error removing user {name}: {e}")
        return jsonify({"success": False, "message": str(e)}), 500


@app.route("/select-user", methods=["POST"])
def select_user():
    data = request.json
    name = normalize_name(data.get("name") or "")
    users = load_authorized_users()
    if name and name in users:
        set_selected_person(name)
        return jsonify({"success": True, "selected": name})
    set_selected_person(None)
    return jsonify({"success": False, "message": "Unknown user"}), 400


@app.route("/selected-user", methods=["GET"])
def get_selected_user():
    return jsonify({"selected": get_selected_person()})


def open_browser():
    try:
        webbrowser.open("http://127.0.0.1:5000")
        logging.info("Browser launched.")
    except Exception as e:
        logging.error(f"Failed to open browser: {e}")


if __name__ == "__main__":
    threading.Thread(target=monitor_proximity, daemon=True).start()
    logging.info("Starting Flask app...")
    threading.Timer(1.25, open_browser).start()
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )
