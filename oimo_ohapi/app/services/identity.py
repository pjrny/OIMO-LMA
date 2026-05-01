"""Face extraction + embedding (InsightFace).

For MVP we store the largest face crop as the InstantID reference image and a
SHA256 of the embedding for dedupe / consent enforcement.
"""
from __future__ import annotations
import hashlib, io
from typing import Tuple
import numpy as np
from PIL import Image

try:
    from insightface.app import FaceAnalysis
    _APP: FaceAnalysis | None = None

    def _get_app() -> FaceAnalysis:
        global _APP
        if _APP is None:
            _APP = FaceAnalysis(name="antelopev2", providers=["CPUExecutionProvider"])
            _APP.prepare(ctx_id=-1, det_size=(640, 640))
        return _APP
except Exception:  # insightface optional during early dev
    _get_app = None  # type: ignore


def extract_face(image_bytes: bytes) -> Tuple[bytes, str]:
    """Return (cropped_face_png_bytes, embedding_sha256)."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    arr = np.array(img)[:, :, ::-1]  # RGB->BGR

    if _get_app is None:
        # Fallback: use the whole image, hash raw bytes
        digest = hashlib.sha256(image_bytes).hexdigest()
        return image_bytes, digest

    faces = _get_app().get(arr)
    if not faces:
        raise ValueError("No face detected in selfie")
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    x1, y1, x2, y2 = [max(0, int(v)) for v in face.bbox]
    crop = img.crop((x1, y1, x2, y2))
    buf = io.BytesIO()
    crop.save(buf, format="PNG")
    digest = hashlib.sha256(face.normed_embedding.tobytes()).hexdigest()
    return buf.getvalue(), digest
