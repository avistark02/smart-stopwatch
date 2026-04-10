"""Configuration settings for Blinq Presence Time Tracker."""

import os

# Project root (folder containing this file)
_ROOT = os.path.dirname(os.path.abspath(__file__))

# Vercel Environment Detection
IS_VERCEL = os.environ.get("VERCEL") == "1"
_DATA_DIR = "/tmp" if IS_VERCEL else _ROOT

# Face Recognition (Thresholds used by frontend)
FACE_TOLERANCE = 0.45

# Proximity Detection
BUFFER_TIME = 2  # Seconds to buffer presence before state change
POLL_INTERVAL = 2.0  # Seconds between polling frames
CAMERA_RETRY_INTERVAL = 2  # Seconds between camera reconnection attempts
CAMERA_MAX_RETRIES = 5  # Maximum attempts before longer wait

# Server Settings
SENSOR_ID = "123"
SERVER_URL = "http://127.0.0.1:5000/status"

# File Paths (anchored to _DATA_DIR for Vercel/Production compatibility)
KNOWN_FACES_FILE = os.path.join(_DATA_DIR, "known_faces.json")
AUTHORIZED_USERS_FILE = os.path.join(_DATA_DIR, "authorized_users.json")
STATUS_FILE = os.path.join(_DATA_DIR, "status.json")
SESSION_LOG_FILE = os.path.join(_DATA_DIR, "session_log.json")

# Enrollment
ENROLLMENT_TIMEOUT = 30
ENROLLMENT_FACE_SIZE_MIN = (80, 80)
ENROLLMENT_FACE_SIZE_MAX = (350, 350)

# Logging
LOG_LEVEL = "DEBUG"
LOG_FILE = os.path.join(_DATA_DIR, "blinq.log")
DEBUG_DIR = os.path.join(_DATA_DIR, "debug")
