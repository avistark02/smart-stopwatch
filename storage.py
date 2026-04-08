"""Centralized file storage operations for Blinq : Presence time calculator using python and open cv."""

import os
import re
import pickle
import json
import logging
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet

SECRET_KEY_FILE = "secret.key"

def get_fernet() -> Fernet:
    if not os.path.exists(SECRET_KEY_FILE):
        key = Fernet.generate_key()
        with open(SECRET_KEY_FILE, "wb") as f:
            f.write(key)
    with open(SECRET_KEY_FILE, "rb") as f:
        key = f.read()
    return Fernet(key)

logger = logging.getLogger(__name__)

from config import KNOWN_FACES_FILE, AUTHORIZED_USERS_FILE, ENROLLED_THUMBS_DIR


def thumbnail_basename(normalized_name: str) -> str:
    """Safe filename for a normalized user name (ASCII-ish, no path chars)."""
    safe = re.sub(r"[^a-z0-9._-]+", "_", (normalized_name or "").strip())
    if not safe:
        safe = "user"
    return f"{safe[:120]}.jpg"


def enrolled_thumbnail_path(name: str) -> str:
    """Absolute path to the JPEG thumbnail for this user, if stored."""
    norm = normalize_name(name)
    return os.path.join(os.path.abspath(ENROLLED_THUMBS_DIR), thumbnail_basename(norm))


def has_enrollment_thumbnail(name: str) -> bool:
    return os.path.isfile(enrolled_thumbnail_path(name))


def save_enrollment_thumbnail(name: str, rgb_image: Any, face_location: tuple) -> None:
    """Save a cropped face JPEG for display next to the user's name. rgb_image: HxWx3 uint8 RGB."""
    try:
        from PIL import Image
        import numpy as np
    except ImportError as e:
        logger.warning("Could not save enrollment thumbnail (PIL/numpy): %s", e)
        return

    top, right, bottom, left = face_location
    h, w = rgb_image.shape[:2]
    top = max(0, int(top))
    left = max(0, int(left))
    bottom = min(h, int(bottom))
    right = min(w, int(right))
    if bottom <= top or right <= left:
        logger.warning("Invalid face box for thumbnail; skipping")
        return

    crop = np.asarray(rgb_image[top:bottom, left:right])
    if crop.size == 0:
        logger.warning("Empty face crop for thumbnail; skipping")
        return
    if crop.dtype != np.uint8:
        crop = np.clip(crop, 0, 255).astype(np.uint8)
    os.makedirs(os.path.abspath(ENROLLED_THUMBS_DIR), exist_ok=True)
    img = Image.fromarray(crop)
    try:
        resample = Image.Resampling.LANCZOS
    except AttributeError:
        resample = Image.LANCZOS
    img.thumbnail((160, 160), resample)
    path = enrolled_thumbnail_path(name)
    img.convert("RGB").save(path, "JPEG", quality=88)
    logger.info("Saved enrollment thumbnail: %s", path)


def delete_enrollment_thumbnail(name: str) -> None:
    path = enrolled_thumbnail_path(name)
    if os.path.isfile(path):
        try:
            os.remove(path)
        except OSError as e:
            logger.warning("Could not remove thumbnail %s: %s", path, e)


def normalize_name(name: str) -> str:
    """Normalize user name for consistent case-insensitive handling.
    
    Args:
        name: Raw user name
        
    Returns:
        Normalized name (stripped and lowercase)
    """
    return (name or "").strip().lower()


def load_known_faces() -> Dict[str, Any]:
    """Load face encodings from pickle file.
    
    Returns:
        Dictionary mapping names (normalized) to face encoding arrays.
    """
    try:
        with open(KNOWN_FACES_FILE, "rb") as f:
            file_data = f.read()
            fernet = get_fernet()
            try:
                decrypted_data = fernet.decrypt(file_data)
                data = pickle.loads(decrypted_data)
            except Exception:
                # Fallback to unencrypted pickle for backward compatibility
                data = pickle.loads(file_data)
            # Normalize all keys on load to handle legacy data
            return {normalize_name(k): v for k, v in data.items()} if data else {}
    except FileNotFoundError:
        logger.info(f"No existing {KNOWN_FACES_FILE} found, starting fresh")
        return {}
    except Exception as e:
        logger.error(f"Failed to load known faces: {e}")
        return {}


def save_known_faces(data: Dict[str, Any]) -> None:
    """Save face encodings to pickle file.
    
    Args:
        data: Dictionary mapping names to face encoding arrays.
    """
    try:
        fernet = get_fernet()
        pickled_data = pickle.dumps(data)
        encrypted_data = fernet.encrypt(pickled_data)
        with open(KNOWN_FACES_FILE, "wb") as f:
            f.write(encrypted_data)
        logger.debug(f"Saved {len(data)} known faces to {KNOWN_FACES_FILE}")
    except Exception as e:
        logger.error(f"Failed to save known faces: {e}")


def load_authorized_users() -> List[str]:
    """Load list of authorized users from JSON file (normalized).
    
    Returns:
        List of authorized user names (lowercase, deduplicated).
    """
    try:
        with open(AUTHORIZED_USERS_FILE, "r") as f:
            users = json.load(f)
            if isinstance(users, list):
                # Normalize all names and deduplicate
                normalized = list(set(normalize_name(u) for u in users if u))
                return sorted(normalized)
            logger.warning(f"{AUTHORIZED_USERS_FILE} is not a list, returning empty")
            return []
    except FileNotFoundError:
        logger.info(f"No existing {AUTHORIZED_USERS_FILE} found")
        return []
    except Exception as e:
        logger.error(f"Failed to load authorized users: {e}")
        return []


def save_authorized_users(users: List[str]) -> None:
    """Save list of authorized users to JSON file (normalized).
    
    Args:
        users: List of authorized user names (will be normalized).
    """
    try:
        # Normalize and deduplicate before saving
        normalized = sorted(set(normalize_name(u) for u in users if u))
        with open(AUTHORIZED_USERS_FILE, "w") as f:
            json.dump(normalized, f, indent=2)
        logger.debug(f"Saved {len(normalized)} authorized users to {AUTHORIZED_USERS_FILE}")
    except Exception as e:
        logger.error(f"Failed to save authorized users: {e}")


def user_exists(name: str) -> bool:
    """Check if a user is authorized.
    
    Args:
        name: User name to check.
        
    Returns:
        True if user is in authorized users list.
    """
    norm_name = normalize_name(name)
    users = load_authorized_users()
    return norm_name in users


def add_authorized_user(name: str) -> bool:
    """Add a user to authorized users list.
    
    Args:
        name: User name to add.
        
    Returns:
        True if successful.
    """
    norm_name = normalize_name(name)
    users = load_authorized_users()
    if norm_name not in users:
        users.append(norm_name)
        save_authorized_users(users)
        logger.info(f"Added authorized user: {norm_name}")
        return True
    return False


def remove_authorized_user(name: str) -> bool:
    """Remove a user from authorized users list and delete their encoding.
    
    Args:
        name: User name to remove.
        
    Returns:
        True if successful.
    """
    norm_name = normalize_name(name)
    # Remove from authorized list
    users = load_authorized_users()
    if norm_name in users:
        users = [u for u in users if u != norm_name]
        save_authorized_users(users)
    
    # Remove from known faces
    known = load_known_faces()
    if norm_name in known:
        del known[norm_name]
        save_known_faces(known)
        delete_enrollment_thumbnail(norm_name)
        logger.info(f"Removed user: {norm_name}")
        return True

    return False


def get_face_encoding(name: str) -> Optional[Any]:
    """Retrieve face encoding for a specific user.
    
    Args:
        name: User name.
        
    Returns:
        Face encoding array or None if not found.
    """
    norm_name = normalize_name(name)
    known = load_known_faces()
    return known.get(norm_name)


def set_face_encoding(name: str, encoding: Any) -> None:
    """Save face encoding for a user.
    
    Args:
        name: User name.
        encoding: Face encoding array from face_recognition library.
    """
    norm_name = normalize_name(name)
    known = load_known_faces()
    known[norm_name] = encoding
    save_known_faces(known)
    logger.info(f"Saved face encoding for: {norm_name}")
