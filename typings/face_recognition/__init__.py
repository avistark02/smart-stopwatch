"""Lightweight stubs for `face_recognition` used only to satisfy editors/Pylance.

These are NOT the real implementations. They let static analysis (Pylance)
resolve imports so you can work in the editor before installing the real
`face_recognition` package.
"""
from typing import List, Tuple, Optional, Any


def face_locations(image: Any) -> List[Tuple[int, int, int, int]]:
    """Return a list of face bounding boxes as (top, right, bottom, left).

    This is a stub. The real function is provided by the face_recognition package.
    """
    raise NotImplementedError("stub: install the real face_recognition package")


def face_encodings(image: Any, known_face_locations: Optional[List[Tuple[int, int, int, int]]] = None) -> List[List[float]]:
    """Return a list of 128-d numeric face encodings for each face in the image.

    Stub only; real implementation is in the package.
    """
    raise NotImplementedError("stub: install the real face_recognition package")


def compare_faces(known_face_encodings: List[List[float]], face_encoding_to_check: List[float], tolerance: float = 0.6) -> List[bool]:
    """Compare a list of known encodings against a candidate encoding.

    Returns a list of booleans. Stub only.
    """
    raise NotImplementedError("stub: install the real face_recognition package")
