"""Configuration settings for Blinq Presence Time Tracker."""

import os

# Project root (folder containing this file) — stable paths even if cwd differs when running `python app.py`
_ROOT = os.path.dirname(os.path.abspath(__file__))

# Face Recognition
FACE_TOLERANCE = 0.45          # Detection: stricter match needed to recognize a known person
                                # Lower = stricter. Range: 0.0 (strictest) to 1.0 (loosest)
FACE_DUPLICATE_TOLERANCE = 0.42 # Block enrolling a DIFFERENT face under same name
ENROLLMENT_RECHECK_TOLERANCE = 0.60  # Re-enrollment: more lenient — same person across sessions
                                      # num_jitters=1 live vs stored num_jitters=5 adds ~0.05-0.10 distance
                                      # so we allow up to 0.60 to correctly detect the same person
FACE_MIN_WIDTH = 80    # Minimum face width in pixels for enrollment (relaxed for laptop cams)
FACE_MAX_WIDTH = 350   # Maximum face width in pixels for enrollment (relaxed)

# Proximity Detection
BUFFER_TIME = 2  # Seconds to buffer presence before state change
POLL_INTERVAL = 2.0  # Seconds between polling frames
CAMERA_RETRY_INTERVAL = 2  # Seconds between camera reconnection attempts
CAMERA_MAX_RETRIES = 5  # Maximum attempts before longer wait

# Server Settings
SENSOR_ID = "123"
SERVER_URL = "http://127.0.0.1:5000/status"

# File Paths (anchored to project root so thumbnails and data files are always found)
KNOWN_FACES_FILE = os.path.join(_ROOT, "known_faces.pkl")
AUTHORIZED_USERS_FILE = os.path.join(_ROOT, "authorized_users.json")
ENROLLED_THUMBS_DIR = os.path.join(_ROOT, "enrolled_thumbnails")
STATUS_FILE = os.path.join(_ROOT, "status.json")
SESSION_LOG_FILE = os.path.join(_ROOT, "session_log.json")

# Enrollment
ENROLLMENT_TIMEOUT = 30
ENROLLMENT_FACE_SIZE_MIN = (80, 80)
ENROLLMENT_FACE_SIZE_MAX = (350, 350)

# Logging
LOG_LEVEL = "INFO"
LOG_FILE = os.path.join(_ROOT, "blinq.log")
