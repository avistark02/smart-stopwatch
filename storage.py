"""Centralized file storage operations for Blinq : Presence time calculator."""

import os
import re
import json
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

from config import KNOWN_FACES_FILE, AUTHORIZED_USERS_FILE


def normalize_name(name: str) -> str:
    """Normalize user name for consistent case-insensitive handling."""
    return (name or "").strip().lower()


def load_known_faces() -> Dict[str, List[float]]:
    """Load face descriptors (lists of floats) from JSON file."""
    try:
        if not os.path.exists(KNOWN_FACES_FILE):
             return {}
        with open(KNOWN_FACES_FILE, "r") as f:
            data = json.load(f)
            return {normalize_name(k): v for k, v in data.items()} if data else {}
    except Exception as e:
        logger.error(f"Failed to load known faces: {e}")
        return {}


def save_known_faces(data: Dict[str, List[float]]) -> None:
    """Save face descriptors to JSON file."""
    try:
        with open(KNOWN_FACES_FILE, "w") as f:
            json.dump(data, f, indent=2)
        logger.debug(f"Saved {len(data)} known faces to {KNOWN_FACES_FILE}")
    except Exception as e:
        logger.error(f"Failed to save known faces: {e}")


def load_authorized_users() -> List[str]:
    """Load list of authorized users from JSON file."""
    try:
        if not os.path.exists(AUTHORIZED_USERS_FILE):
             return []
        with open(AUTHORIZED_USERS_FILE, "r") as f:
            users = json.load(f)
            if isinstance(users, list):
                normalized = list(set(normalize_name(u) for u in users if u))
                return sorted(normalized)
            return []
    except Exception as e:
        logger.error(f"Failed to load authorized users: {e}")
        return []


def save_authorized_users(users: List[str]) -> None:
    """Save list of authorized users to JSON file."""
    try:
        normalized = sorted(set(normalize_name(u) for u in users if u))
        with open(AUTHORIZED_USERS_FILE, "w") as f:
            json.dump(normalized, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save authorized users: {e}")


def user_exists(name: str) -> bool:
    norm_name = normalize_name(name)
    users = load_authorized_users()
    return norm_name in users


def add_authorized_user(name: str) -> bool:
    norm_name = normalize_name(name)
    users = load_authorized_users()
    if norm_name not in users:
        users.append(norm_name)
        save_authorized_users(users)
        logger.info(f"Added authorized user: {norm_name}")
        return True
    return False


def remove_authorized_user(name: str) -> bool:
    norm_name = normalize_name(name)
    users = load_authorized_users()
    if norm_name in users:
        users = [u for u in users if u != norm_name]
        save_authorized_users(users)
    
    known = load_known_faces()
    if norm_name in known:
        del known[norm_name]
        save_known_faces(known)
        logger.info(f"Removed user: {norm_name}")
        return True
    return False


def set_face_encoding(name: str, encoding: List[float]) -> None:
    norm_name = normalize_name(name)
    known = load_known_faces()
    known[norm_name] = encoding
    save_known_faces(known)
    logger.info(f"Saved face encoding for: {norm_name}")
