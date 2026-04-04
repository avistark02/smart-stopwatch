"""Presence detection with multi-face enrollment and OpenCV fallback.

Usage:
  python detect_and_send.py                            # run detection
  python detect_and_send.py --enroll NAME              # enroll via webcam
  python detect_and_send.py --enroll-image NAME PATH   # enroll from a photo
  python detect_and_send.py --list                     # list enrolled names
  python detect_and_send.py --delete NAME              # delete an enrolled face
"""
from typing import Any, Dict, List, Optional, Tuple
import argparse
import time
import logging
import os

from storage import (
    load_known_faces, save_known_faces, load_authorized_users,
    set_face_encoding, remove_authorized_user, add_authorized_user, normalize_name
)
from config import (
    FACE_TOLERANCE, FACE_MIN_WIDTH, FACE_MAX_WIDTH, POLL_INTERVAL,
    SERVER_URL, SENSOR_ID, ENROLLMENT_TIMEOUT, LOG_LEVEL, LOG_FILE
)

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def _get_cv2():
    try:
        import cv2
        return cv2
    except Exception as e:
        raise RuntimeError("opencv-python required. Run: pip install opencv-python") from e


def _get_requests():
    try:
        import requests
        return requests
    except Exception:
        return None


USE_FACE_RECOG = True
try:
    import face_recognition  # type: ignore
except Exception:
    USE_FACE_RECOG = False
    logger.warning("face_recognition not available, using OpenCV-only mode")


def send_presence(status: str, who: Optional[str] = None) -> None:
    payload = {"id": SENSOR_ID, "Presence": status}
    if who:
        payload["who"] = who
    try:
        req = _get_requests()
        if req is None:
            return
        req.post(SERVER_URL, json=payload, timeout=5)
        logger.debug(f"Sent: {payload}")
    except Exception as e:
        logger.error(f"Error sending presence: {e}")


_face_cascade = None

def detect_faces_opencv(frame: Any) -> List[Tuple[int, int, int, int]]:
    global _face_cascade
    cv2 = _get_cv2()
    if _face_cascade is None:
        path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _face_cascade = cv2.CascadeClassifier(path)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    rects = _face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    return [(y, x + w, y + h, x) for (x, y, w, h) in rects]


# ---------------------------------------------------------------------------
# Enroll from PHOTO FILE
# ---------------------------------------------------------------------------

def check_if_face_already_enrolled(face_encoding) -> Optional[str]:
    """Check if a face encoding matches any already-enrolled face.

    Returns:
        Name of the enrolled person if found, None otherwise.
    """
    if not USE_FACE_RECOG:
        return None

    known = load_known_faces()
    if not known:
        return None

    known_names = list(known.keys())
    known_encodings = list(known.values())

    distances = face_recognition.face_distance(known_encodings, face_encoding)
    best_idx = int(min(range(len(distances)), key=lambda j: distances[j]))
    best_dist = distances[best_idx]

    if best_dist < FACE_TOLERANCE:
        return known_names[best_idx]
    return None


def enroll_from_image(name: str, image_path: str) -> tuple[bool, str]:
    """Enroll a face from a photo file — better accuracy than a laptop webcam.

    Tips for best results:
    - Use a clear, well-lit front-facing photo
    - Only one face should be in the photo
    - Phone selfies in good light work great

    Returns:
        (success: bool, message: str)
    """
    if not USE_FACE_RECOG:
        logger.error("face_recognition package required for enrollment.")
        return False, "face_recognition package required"

    name = normalize_name(name)

    if not os.path.isfile(image_path):
        msg = f"File not found: {image_path}"
        print(f"ERROR: {msg}")
        return False, msg

    try:
        image = face_recognition.load_image_file(image_path)
    except Exception as e:
        msg = f"Could not open image: {e}"
        print(f"ERROR: {msg}")
        return False, msg

    print(f"Processing photo for '{name}'...")
    locations = face_recognition.face_locations(image, model="hog")

    if len(locations) == 0:
        msg = "No face detected in the photo. Use a clear front-facing photo with good lighting."
        print(f"ERROR: {msg}")
        return False, msg

    if len(locations) > 1:
        print(f"WARNING: {len(locations)} faces found. Using the largest one.")
        def area(loc):
            top, right, bottom, left = loc
            return (bottom - top) * (right - left)
        locations = [max(locations, key=area)]

    # num_jitters=10 re-samples the face 10 times for a more robust encoding
    encodings = face_recognition.face_encodings(image, locations, num_jitters=10)
    if not encodings:
        msg = "Could not compute face encoding. Try a clearer photo."
        print(f"ERROR: {msg}")
        return False, msg

    # Check if this face is already enrolled
    detected_as = check_if_face_already_enrolled(encodings[0])
    if detected_as:
        if detected_as == name:
            msg = f"'{name}' is already enrolled. Re-enrollment will update their face data."
            print(f"INFO: {msg}")
            set_face_encoding(name, encodings[0])
            logger.info(f"Re-enrolled '{name}' from image: {image_path}")
            return True, msg
        else:
            msg = f"This face is already enrolled as '{detected_as}', not '{name}'"
            print(f"ERROR: {msg}")
            return False, msg

    set_face_encoding(name, encodings[0])
    add_authorized_user(name)
    msg = f"'{name}' enrolled from photo"
    print(f"SUCCESS: {msg}")
    logger.info(f"Enrolled '{name}' from image: {image_path}")
    return True, msg


# ---------------------------------------------------------------------------
# Enroll from WEBCAM (improved: collects multiple samples)
# ---------------------------------------------------------------------------

def enroll_face(name: str, timeout: int = ENROLLMENT_TIMEOUT) -> tuple[bool, str]:
    """Enroll via webcam. Collects 5 samples and averages them for accuracy.

    Returns:
        (success: bool, message: str)
    """
    if not USE_FACE_RECOG:
        logger.error("face_recognition package required.")
        return False, "face_recognition package required"

    import numpy as np
    name = normalize_name(name)
    cv2 = _get_cv2()
    cap = cv2.VideoCapture(0)
    start = time.time()
    REQUIRED_SAMPLES = 5
    collected = []
    logger.info(f"Webcam enrollment for '{name}', timeout={timeout}s")

    try:
        while time.time() - start < timeout:
            ret, frame = cap.read()
            if not ret:
                continue

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            locations = face_recognition.face_locations(rgb, model="hog")
            progress = f"{len(collected)}/{REQUIRED_SAMPLES}"

            if len(locations) == 0:
                cv2.putText(frame, "No face detected", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                cv2.putText(frame, "Look at the camera", (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
            elif len(locations) > 1:
                cv2.putText(frame, "Multiple faces — one person only", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            else:
                top, right, bottom, left = locations[0]
                width = right - left
                height = bottom - top
                cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
                cv2.putText(frame, f"Samples: {progress}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)

                if width < FACE_MIN_WIDTH or height < FACE_MIN_WIDTH:
                    cv2.putText(frame, "Move closer", (10, 70),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                elif width > FACE_MAX_WIDTH or height > FACE_MAX_WIDTH:
                    cv2.putText(frame, "Move farther back", (10, 70),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                else:
                    cv2.putText(frame, "Hold still...", (10, 70),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
                    encs = face_recognition.face_encodings(rgb, locations, num_jitters=5)
                    if encs:
                        collected.append(encs[0])
                        logger.debug(f"Sample {len(collected)} captured")

                    if len(collected) >= REQUIRED_SAMPLES:
                        final_encoding = np.mean(collected, axis=0)

                        # Check if this face is already enrolled
                        detected_as = check_if_face_already_enrolled(final_encoding)
                        if detected_as:
                            if detected_as == name:
                                msg = f"'{name}' is already enrolled. Re-enrollment will update their face data."
                                cv2.putText(frame, "Already enrolled! Updating...", (10, 120),
                                           cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 165, 255), 2)
                                cv2.imshow("Enroll", frame)
                                cv2.waitKey(2000)
                                set_face_encoding(name, final_encoding)
                                logger.info(f"Re-enrolled '{name}' from {REQUIRED_SAMPLES} webcam samples")
                                return True, msg
                            else:
                                msg = f"This face is already enrolled as '{detected_as}', not '{name}'"
                                cv2.putText(frame, f"Already enrolled as: {detected_as}", (10, 120),
                                           cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                                cv2.imshow("Enroll", frame)
                                cv2.waitKey(2000)
                                logger.warning(msg)
                                return False, msg

                        set_face_encoding(name, final_encoding)
                        add_authorized_user(name)
                        cv2.putText(frame, "Enrolled successfully!", (10, 120),
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                        cv2.imshow("Enroll", frame)
                        cv2.waitKey(2000)
                        msg = f"'{name}' enrolled successfully"
                        logger.info(f"Enrolled '{name}' from {REQUIRED_SAMPLES} webcam samples")
                        return True, msg

            cv2.putText(frame, "Press Q to cancel", (10, frame.shape[0] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
            cv2.imshow("Enroll", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()

    msg = "Enrollment timed out or cancelled"
    logger.warning(msg)
    return False, msg


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def list_known() -> None:
    known = load_known_faces()
    if not known:
        print("No faces enrolled yet.")
        return
    print("Enrolled faces:")
    for name in sorted(known.keys()):
        print(f"  - {name}")


def delete_face(name: str) -> None:
    name = normalize_name(name)
    remove_authorized_user(name)
    print(f"Deleted '{name}'.")


def load_face_encoding_from_image(image_path: str):
    try:
        image = face_recognition.load_image_file(image_path)
        locations = face_recognition.face_locations(image)
        if not locations:
            return None
        encodings = face_recognition.face_encodings(image, locations)
        return encodings[0] if encodings else None
    except Exception as e:
        logger.error(f"Failed to load image '{image_path}': {e}")
        return None


# ---------------------------------------------------------------------------
# Detection loop
# ---------------------------------------------------------------------------

def run_detection(poll_interval: float = POLL_INTERVAL, match_encoding=None) -> None:
    cv2 = _get_cv2()
    cap = cv2.VideoCapture(0)

    last_status = "inactive"
    inactive_count = 0
    buffer_limit = 3
    known = load_known_faces()
    known_names = list(known.keys())
    known_encodings = list(known.values())
    authorized_users = load_authorized_users()
    timer_active = False
    timer_start: Optional[float] = None
    last_check = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                send_presence("inactive")
                break

            key = cv2.waitKey(1) & 0xFF
            now = time.time()
            if now - last_check < poll_interval:
                cv2.imshow("Proximity Detection", frame)
                if key == ord('q'):
                    send_presence("inactive")
                    break
                continue
            last_check = now

            status = "inactive"
            who: Optional[str] = None
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            face_locations = []
            face_encodings_list = []

            if USE_FACE_RECOG:
                face_locations = face_recognition.face_locations(rgb_frame)
                face_encodings_list = face_recognition.face_encodings(rgb_frame, face_locations)

            if match_encoding is not None and USE_FACE_RECOG:
                present = any(
                    face_recognition.compare_faces([match_encoding], fe, tolerance=FACE_TOLERANCE)[0]
                    for fe in face_encodings_list
                )
                status = "active" if present else "inactive"
                if present:
                    who = "reference_photo"

            elif USE_FACE_RECOG and known_encodings:
                if face_encodings_list:
                    recognized = False
                    for fe in face_encodings_list:
                        distances = face_recognition.face_distance(known_encodings, fe)
                        best_idx = int(min(range(len(distances)), key=lambda j: distances[j]))
                        best_dist = distances[best_idx]
                        logger.debug(f"Best: {known_names[best_idx]} dist={best_dist:.3f}")
                        if best_dist < FACE_TOLERANCE:
                            detected = known_names[best_idx]
                            status = "active" if detected in authorized_users else "error"
                            who = detected
                            inactive_count = 0
                            recognized = True
                            break
                    if not recognized:
                        status = "error"
                        who = "unknown"
                        inactive_count = 0
                else:
                    inactive_count += 1
                    status = "inactive" if inactive_count >= buffer_limit else last_status
            else:
                if detect_faces_opencv(frame):
                    status = "error"
                    who = "unknown"
                else:
                    inactive_count += 1
                    status = "inactive" if inactive_count >= buffer_limit else last_status

            if match_encoding is not None:
                if status == "active" and not timer_active:
                    timer_active = True
                    timer_start = time.time()
                elif status != "active" and timer_active:
                    timer_active = False
                    logger.info(f"Timer: {time.time() - timer_start:.2f}s")

            if key == ord('s') and not timer_active:
                timer_active = True
                timer_start = time.time()
            elif key == ord('t') and timer_active and timer_start:
                timer_active = False

            if timer_active and timer_start:
                cv2.putText(frame, f"Timer: {time.time() - timer_start:.1f}s", (10, 140),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

            cv2.putText(frame, "s=start  t=stop  q=quit", (10, 180),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

            if status != last_status or (status in ("active", "error") and who):
                send_presence(status, who)
                last_status = status

            cv2.imshow("Proximity Detection", frame)
            if key == ord('q'):
                send_presence("inactive")
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(
        description="Smart Stopwatch face detection",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog="""
Examples:
  Enroll from a photo (best quality):
    python detect_and_send.py --enroll-image avinash "C:\\Users\\HP\\Pictures\\me.jpg"

  Enroll via webcam:
    python detect_and_send.py --enroll avinash

  List enrolled faces:
    python detect_and_send.py --list

  Delete a face:
    python detect_and_send.py --delete avinash
        """
    )
    p.add_argument("--enroll",        help="Enroll via webcam under NAME")
    p.add_argument("--enroll-image",  nargs=2, metavar=("NAME", "IMAGE_PATH"),
                   help="Enroll from a photo file (recommended)")
    p.add_argument("--list",          action="store_true", help="List enrolled faces")
    p.add_argument("--delete",        help="Delete an enrolled face by NAME")
    p.add_argument("--interval",      type=float, default=POLL_INTERVAL)
    p.add_argument("--match-image",   help="Match camera to a reference image")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if not USE_FACE_RECOG:
        logger.warning("face_recognition not available.")

    if args.list:
        list_known()
    elif args.enroll:
        enroll_face(args.enroll)
    elif args.enroll_image:
        name, path = args.enroll_image
        enroll_from_image(name, path)
    elif args.delete:
        delete_face(args.delete)
    else:
        ref = None
        if args.match_image:
            ref = load_face_encoding_from_image(args.match_image)
        run_detection(poll_interval=args.interval, match_encoding=ref)
