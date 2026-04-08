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
import math
import os
import threading
import numpy as np

from storage import (
    load_known_faces, save_known_faces, load_authorized_users,
    set_face_encoding, remove_authorized_user, add_authorized_user, normalize_name
)
from config import (
    FACE_TOLERANCE, FACE_MIN_WIDTH, FACE_MAX_WIDTH, POLL_INTERVAL,
    SERVER_URL, SENSOR_ID, ENROLLMENT_TIMEOUT, LOG_LEVEL, LOG_FILE,
    ENROLLMENT_RECHECK_TOLERANCE
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


def _open_camera(index: int = 0):
    """Open webcam with stable settings for Windows OpenCV.

    Strategy:
      1. Try MSMF (default) with explicit MJPEG + 640x480 — clean decoded frames.
         The previous MSMF bug (Error -1072873821) was caused by double cap.grab();
         that is now removed, so MSMF is safe again and avoids DirectShow format issues.
      2. Fall back to CAP_DSHOW if MSMF fails to open.

    Horizontal static with CAP_DSHOW is caused by format negotiation failure:
    DirectShow sometimes picks NV12/YUY2 with incorrect stride, causing visual corruption.
    """
    cv2 = _get_cv2()

    def _configure(cap):
        """Set resolution and MJPEG codec — avoids raw YUV format mismatches."""
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)

    # 1. Try MSMF (default backend — works cleanly once double-grab is removed)
    cap = cv2.VideoCapture(index)
    if cap.isOpened():
        _configure(cap)
        logger.info(f"Camera {index} opened via MSMF (default backend)")
        return cap
    cap.release()

    # 2. Fallback: DirectShow
    logger.warning("MSMF failed, trying CAP_DSHOW fallback")
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if cap.isOpened():
        _configure(cap)
        logger.info(f"Camera {index} opened via DirectShow (CAP_DSHOW)")
        return cap
    cap.release()

    raise RuntimeError(
        f"Could not open camera at index {index}. "
        "Check that no other app (Teams, Zoom, etc.) is using the camera."
    )


def _is_frame_valid(frame) -> bool:
    """Return False for corrupt, black, or static-noise frames.

    Used to:
      1. Gate the warmup loop (wait for camera to produce a real image)
      2. Softly skip face detection on bad frames (display still updates)

    Thresholds are intentionally wide — do NOT use this to gate cv2.imshow().
    Always show the frame to keep the feed live; only skip processing here.

    std < 2   → all-black / camera not initialised yet
    std > 127 → pure random static / corrupt signal (max possible is ~73 for
                uniform noise, so 127 gives a generous safety margin for real scenes
                with extreme contrast like bright windows or LED backlighting)
    """
    if frame is None:
        return False
    if len(frame.shape) < 2 or frame.shape[0] < 10 or frame.shape[1] < 10:
        return False
    std = float(frame.std())
    return 2.0 < std < 127.0


class CameraStream:
    """Background thread to drain camera buffer.
    
    Processing face_locations takes ~150ms per frame. If we read synchronously, 
    the camera buffer fills up, causing brutal delay or freezing the MSMF driver.
    This thread reads as fast as the camera can output, always keeping the most
    recent frame in memory for the main loop to use immediately.
    """
    def __init__(self, index: int = 0):
        self.cap = _open_camera(index)
        self.ret, self.frame = self.cap.read()
        self.stopped = False
        self.lock = threading.Lock()

    def start(self):
        self.thread = threading.Thread(target=self.update, args=())
        self.thread.daemon = True
        self.thread.start()
        return self

    def update(self):
        while not self.stopped:
            ret, frame = self.cap.read()
            with self.lock:
                self.ret = ret
                if ret and frame is not None:
                    self.frame = frame

    def read(self):
        # Return a copy of the latest frame to avoid thread-safety tearing during imshow
        with self.lock:
            if not self.ret or self.frame is None:
                return False, None
            return self.ret, self.frame.copy()

    def release(self):
        self.stopped = True
        if hasattr(self, 'thread'):
            self.thread.join(timeout=1.0)
        if self.cap:
            self.cap.release()


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

def check_if_face_already_enrolled(face_encoding, tolerance: float = FACE_TOLERANCE) -> Optional[str]:
    """Check if a face encoding matches any already-enrolled face.

    Args:
        face_encoding: The face encoding to check.
        tolerance: Distance threshold. Use ENROLLMENT_RECHECK_TOLERANCE (0.60) when
                   checking during webcam enrollment (num_jitters=1 live vs stored
                   higher-jitter encodings have more variance for the same face).
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

    logger.debug(f"Duplicate check — best match: {known_names[best_idx]} dist={best_dist:.3f} (threshold={tolerance})")
    if best_dist < tolerance:
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
    """Enroll via webcam. Collects REQUIRED_SAMPLES good samples then averages them.

    Resilient to brief face movements:
    - Grace buffer: 8 consecutive missing frames before showing a warning
    - Timeout pauses when face is absent (only counts down active scanning time)
    - Collected samples are NEVER reset due to movement
    """
    if not USE_FACE_RECOG:
        logger.error("face_recognition package required.")
        return False, "face_recognition package required"

    name = normalize_name(name)
    cv2 = _get_cv2()
    # Start the background thread which prevents buffer overflow freezes
    cap = CameraStream(0).start()

    # Drain frames until we get a clean, non-corrupt frame (or give up after 3s)
    logger.info("Waiting for camera to produce a clean frame...")
    _warmup_deadline = time.time() + 3.0
    while time.time() < _warmup_deadline:
        ret, frame = cap.read()
        if ret and _is_frame_valid(frame):
            logger.info("Camera ready (clean frame received)")
            break
        time.sleep(0.05)
    else:
        logger.warning("Camera warmup timed out — may produce distorted frames initially")

    REQUIRED_SAMPLES = 5
    SAMPLE_COOLDOWN  = 0.3   # Min seconds between samples (forces diverse angles)
    GRACE_FRAMES     = 8     # Consecutive frames without face before showing warning
                             # ~8 frames ≈ 0.5-1s at typical processing speed

    collected        = []
    last_sample_time = 0.0
    no_face_streak   = 0     # Consecutive frames with no valid face
    active_elapsed   = 0.0   # Seconds spent actively scanning (face present)
    last_active_time = None  # Wall-clock time when face was last actively scanning

    result_msg      = ""
    result_success  = False
    result_deadline = None

    logger.info(f"Webcam enrollment for '{name}', timeout={timeout}s (active face time)")

    try:
        while True:
            # ── Post-result: keep camera live for 2.5s showing outcome ──────
            if result_deadline is not None:
                if time.time() > result_deadline:
                    break

            # ── Timeout: only counts down ACTIVE face-scanning time ──────────
            elif active_elapsed >= timeout:
                result_msg = "Enrollment timed out — position face in frame and try again"
                result_success = False
                break

            # Read latest frame
            ret, frame = cap.read()
            if not ret or frame is None:
                time.sleep(0.05)
                continue

            # Normalize to 8-bit BGR (handles RGBA, 16-bit, grayscale webcams)
            if frame.dtype != np.uint8:
                frame = (frame / frame.max() * 255).astype(np.uint8) if frame.max() > 0 else frame.astype(np.uint8)
            if len(frame.shape) == 2:
                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
            elif frame.shape[2] == 4:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

            # ── Post-result display on live feed ─────────────────────────────
            if result_deadline is not None:
                color = (0, 255, 0) if result_success else (0, 0, 255)
                cv2.putText(frame, result_msg, (10, 50),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)
                secs_left = max(0, int(result_deadline - time.time()))
                cv2.putText(frame, f"Closing in {secs_left}s...", (10, 90),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
                cv2.imshow("Enroll", frame)
                cv2.waitKey(1)
                continue

            # ── Detect face ───────────────────────────────────────────────────
            # NOTE: we NEVER skip cv2.imshow() — always show the frame to keep
            # the feed live. Only face detection is skipped on bad frames.
            locations = []
            if _is_frame_valid(frame):
                try:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    locations = face_recognition.face_locations(rgb, model="hog")
                except Exception as e:
                    logger.warning(f"face_locations error (frame shown, detection skipped): {e}")
                    locations = []
            else:
                logger.debug("Corrupt/invalid frame — display updated, face detection skipped")


            progress   = f"{len(collected)}/{REQUIRED_SAMPLES}"
            face_ok    = False   # True when exactly one face is in the good size range

            if len(locations) == 0 or len(locations) > 1:
                no_face_streak += 1
                # Pause active-time counter when face is absent
                last_active_time = None

                # Only show warning after GRACE_FRAMES consecutive missing frames
                # so 1-2 frame blips are invisible to the user
                if no_face_streak > GRACE_FRAMES:
                    if len(locations) == 0:
                        msg_text = "No face — look at the camera"
                    else:
                        msg_text = "Multiple faces — only one person"
                    cv2.putText(frame, msg_text, (10, 40),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                else:
                    # Grace period: show last known progress as if nothing changed
                    cv2.putText(frame, f"Samples: {progress}", (10, 35),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 0), 2)
                    cv2.putText(frame, "Hold still...", (10, 75),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 200, 0), 2)
            else:
                # Valid single face — reset streak and accumulate active time
                no_face_streak = 0
                now = time.time()
                if last_active_time is not None:
                    active_elapsed += now - last_active_time
                last_active_time = now

                top, right, bottom, left = locations[0]
                width  = right - left
                height = bottom - top
                cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
                cv2.putText(frame, f"Samples: {progress}", (10, 35),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 0), 2)

                if width < FACE_MIN_WIDTH or height < FACE_MIN_WIDTH:
                    cv2.putText(frame, "Move closer", (10, 75),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                elif width > FACE_MAX_WIDTH or height > FACE_MAX_WIDTH:
                    cv2.putText(frame, "Move farther back", (10, 75),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
                else:
                    face_ok = True
                    cv2.putText(frame, "Hold still...", (10, 75),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

                    if now - last_sample_time >= SAMPLE_COOLDOWN:
                        try:
                            encs = face_recognition.face_encodings(rgb, locations, num_jitters=2)
                            if encs:
                                collected.append(encs[0])
                                last_sample_time = now
                                logger.debug(f"Sample {len(collected)}/{REQUIRED_SAMPLES} captured")
                        except Exception as e:
                            logger.warning(f"Encoding error (skipping sample): {e}")

            # ── Check completion (runs every frame — movement-safe) ───────────
            if len(collected) >= REQUIRED_SAMPLES:
                final_encoding = np.mean(collected, axis=0)
                detected_as = check_if_face_already_enrolled(
                    final_encoding, tolerance=ENROLLMENT_RECHECK_TOLERANCE
                )

                if detected_as:
                    if detected_as == name:
                        result_msg = f"Already enrolled as '{name}' — updating face data"
                        result_success = True
                        set_face_encoding(name, final_encoding)
                        logger.info(f"Re-enrolled '{name}' from {REQUIRED_SAMPLES} webcam samples")
                    else:
                        result_msg = f"Face already enrolled as '{detected_as}' — cannot enroll as '{name}'"
                        result_success = False
                        logger.warning(result_msg)
                else:
                    set_face_encoding(name, final_encoding)
                    add_authorized_user(name)
                    result_msg = f"'{name}' enrolled successfully!"
                    result_success = True
                    logger.info(f"Enrolled '{name}' from {REQUIRED_SAMPLES} webcam samples")

                result_deadline = time.time() + 2.5
                collected = []  # Reset so completion doesn't re-trigger

            # ── HUD footer ────────────────────────────────────────────────────
            time_left = max(0, int(timeout - active_elapsed))
            cv2.putText(frame, f"Active time left: {time_left}s  |  Q = cancel",
                        (10, frame.shape[0] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)
            cv2.imshow("Enroll", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                result_msg = "Enrollment cancelled"
                result_success = False
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()

    if not result_msg:
        result_msg = "Enrollment timed out or cancelled"
        result_success = False
        logger.warning(result_msg)

    return result_success, result_msg


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
    cap = CameraStream(0).start()

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

            # Ensure frame is valid 8-bit BGR before processing
            if frame.dtype != np.uint8:
                frame = (frame / frame.max() * 255).astype(np.uint8) if frame.max() > 0 else frame.astype(np.uint8)
            if len(frame.shape) == 2:
                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
            elif frame.shape[2] == 4:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

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
        description="Blinq : Presence time calculator using python and open cv face detection",
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
