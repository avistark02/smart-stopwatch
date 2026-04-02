from flask import Flask, render_template, request, jsonify
import threading
import time
import logging
import os

from detect_and_send import enroll_face, enroll_from_image
from storage import (
    load_authorized_users, save_authorized_users,
    load_known_faces, remove_authorized_user, normalize_name
)
from config import BUFFER_TIME, FACE_TOLERANCE, CAMERA_RETRY_INTERVAL, CAMERA_MAX_RETRIES, LOG_LEVEL, LOG_FILE

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', template_folder='templates')

status_lock = threading.Lock()
status = {"Presence": "inactive", "who": None}
selected_person = None
selected_person_lock = threading.Lock()


def update_status(presence: str, who: str = None):
    global status
    with status_lock:
        status = {"Presence": presence, "who": who}
        logger.debug(f"Status updated: {status}")


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
        cap = None
        try:
            time.sleep(1)
            logger.info("Attempting to open camera...")
            cap = cv2.VideoCapture(0)

            if not cap.isOpened():
                retry_count += 1
                logger.warning(f"Camera could not be opened, retry {retry_count}/{CAMERA_MAX_RETRIES}")
                if retry_count >= CAMERA_MAX_RETRIES:
                    logger.error("Camera failed repeatedly. Is another app using it?")
                    update_status("inactive")
                    retry_count = 0
                    time.sleep(10)
                else:
                    time.sleep(CAMERA_RETRY_INTERVAL)
                continue

            retry_count = 0
            logger.info("Camera opened successfully")
            last_detected = 0

            while True:
                ret, frame = cap.read()
                if not ret or frame is None:
                    logger.warning("Failed to read frame, reconnecting")
                    break

                person = get_selected_person()
                if person is None:
                    update_status("inactive")
                    time.sleep(0.5)
                    continue

                known_faces = load_known_faces()
                if person not in known_faces:
                    logger.warning(f"No encoding for '{person}' — please enroll first")
                    update_status("inactive")
                    time.sleep(0.5)
                    continue

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                face_locations = face_recognition.face_locations(rgb)
                face_encodings = face_recognition.face_encodings(rgb, face_locations)

                if not face_locations:
                    now = time.time()
                    if now - last_detected > BUFFER_TIME:
                        update_status("inactive")
                    time.sleep(0.5)
                    continue

                # --- FIXED LOGIC ---
                # Check ALL detected faces. If ANY match the selected person → active.
                # Only flag unauthorized if NO faces matched after checking all of them.
                target_encoding = known_faces[person]
                authorized_present = False

                for face_encoding in face_encodings:
                    distance = face_recognition.face_distance([target_encoding], face_encoding)[0]
                    logger.debug(f"Face distance for '{person}': {distance:.3f} (threshold: {FACE_TOLERANCE})")
                    if distance < FACE_TOLERANCE:
                        authorized_present = True
                        break  # found our person — stop checking

                now = time.time()
                if authorized_present:
                    if now - last_detected > BUFFER_TIME:
                        update_status("active", person)
                        logger.info(f"Authorized: {person} (detected)")
                    last_detected = now
                else:
                    # Faces present but none matched — unauthorized
                    if face_encodings:
                        update_status("error", "unauthorized")
                        logger.warning(f"Unauthorized face detected (expected: {person})")
                    last_detected = now

                time.sleep(0.5)

        except Exception as e:
            logger.error(f"Monitor thread error: {e}", exc_info=True)
            update_status("inactive")
            time.sleep(CAMERA_RETRY_INTERVAL)
        finally:
            if cap is not None:
                cap.release()
                logger.info("Camera released")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/status", methods=["GET"])
def get_status():
    with status_lock:
        return jsonify(status)


@app.route("/status/<sensor_id>", methods=["GET"])
def get_status_by_id(sensor_id):
    with status_lock:
        return jsonify(status)


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
    try:
        success = enroll_face(name, timeout=30)
    except Exception as e:
        logger.error(f"Enrollment error for {name}: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    if not success:
        return jsonify({"success": False, "message": "Face enrollment failed"}), 400
    logger.info(f"Successfully enrolled: {name}")
    return jsonify({"success": True, "message": "Enrollment complete"})


@app.route("/enroll-image", methods=["POST"])
def api_enroll_image():
    """Enroll a face from an uploaded photo file path."""
    data = request.json
    name = normalize_name(data.get("name") or "")
    image_path = (data.get("image_path") or "").strip()
    if not name:
        return jsonify({"success": False, "message": "Name is required"}), 400
    if not image_path:
        return jsonify({"success": False, "message": "image_path is required"}), 400
    try:
        success = enroll_from_image(name, image_path)
    except Exception as e:
        logger.error(f"Image enrollment error for {name}: {e}")
        return jsonify({"success": False, "message": str(e)}), 500
    if not success:
        return jsonify({"success": False, "message": "Image enrollment failed — check the photo"}), 400
    return jsonify({"success": True, "message": f"'{name}' enrolled from photo"})


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


if __name__ == "__main__":
    threading.Thread(target=monitor_proximity, daemon=True).start()
    app.run(debug=os.getenv("FLASK_DEBUG", "0") == "1")
