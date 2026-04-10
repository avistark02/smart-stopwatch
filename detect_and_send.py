"""Blinq Presence Time Calculator - Biometric Utilities.

This file handles face enrollment from images and provides consistency checks.
Webcam capture is handled on the client-side (WebRTC) and POSTed to the backend.
"""
from typing import Optional
import logging
import os
import numpy as np

try:
    import face_recognition # type: ignore
    USE_FACE_RECOG = True
except ImportError:
    USE_FACE_RECOG = False

from storage import (
    load_known_faces, set_face_encoding, add_authorized_user, normalize_name
)
from config import (
    FACE_TOLERANCE, LOG_LEVEL, LOG_FILE, ENROLLMENT_RECHECK_TOLERANCE
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

def check_if_face_already_enrolled(face_encoding, tolerance: float = FACE_TOLERANCE) -> Optional[str]:
    """Check if a face encoding matches any already-enrolled face."""
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

    logger.debug(f"Duplicate check — best match: {known_names[best_idx]} dist={best_dist:.3f}")
    if best_dist < tolerance:
        return known_names[best_idx]
    return None

def enroll_from_image(name: str, image_path: str) -> tuple[bool, str, list]:
    """Enroll a face from a photo file. 
    Returns: (success, message, face_locations)
    """
    if not USE_FACE_RECOG:
        logger.error("face_recognition package required for enrollment.")
        return False, "face_recognition package required", []

    name = normalize_name(name)

    try:
        image = face_recognition.load_image_file(image_path)
        logger.debug(f"Image loaded successfully: {image.shape} (H,W,C)")
    except Exception as e:
        logger.error(f"Could not load image file {image_path}: {e}")
        return False, f"Could not open image: {e}", []

    logger.info(f"Detecting faces in photo for '{name}'...")
    locations = face_recognition.face_locations(image, model="hog")
    logger.debug(f"Detected {len(locations)} face(locations): {locations}")

    if len(locations) == 0:
        logger.warning(f"Enrollment FAILED: No face detected in {image_path}. Suggest better lighting.")
        return False, "No face detected. Please ensure your face is well-lit and centered in the frame.", []

    if len(locations) > 1:
        logger.warning(f"{len(locations)} faces found. Using the largest one.")
        def area(loc):
            top, right, bottom, left = loc
            return (bottom - top) * (right - left)
        locations = [max(locations, key=area)]

    encodings = face_recognition.face_encodings(image, locations, num_jitters=10)
    if not encodings:
        logger.error(f"Encoding FAILED for {name} even though face was located.")
        return False, "Could not compute face encoding. Possible image corruption or extreme angle.", locations

    detected_as = check_if_face_already_enrolled(encodings[0])
    if detected_as:
        if detected_as == name:
            set_face_encoding(name, encodings[0])
            logger.info(f"'{name}' re-enrolled (updated encoding).")
            return True, f"'{name}' re-enrolled (data updated).", locations
        else:
            logger.warning(f"Enrollment BLOCKED: Face matches existing user '{detected_as}'")
            return False, f"This face is already enrolled as '{detected_as}'.", locations

    set_face_encoding(name, encodings[0])
    add_authorized_user(name)
    logger.info(f"Successfully enrolled '{name}' from {image_path}")
    return True, f"'{name}' enrolled successfully.", locations
