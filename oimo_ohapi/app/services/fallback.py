"""Provider fallback chain for Strategy B.

Order: ComfyUI (internal) -> xAI grok-imagine + Replicate face-swap -> OhAPI.
Each function returns raw image bytes or raises.
"""
import base64, httpx
from app.core.config import settings


def via_xai_then_replicate(prompt: str, ref_png: bytes) -> bytes:
    if not settings.xai_api_key or not settings.replicate_api_token:
        raise RuntimeError("xAI or Replicate not configured")

    # 1) xAI text->NSFW base scene (no face yet)
    x = httpx.post(
        "https://api.x.ai/v1/images/generations",
        headers={"Authorization": f"Bearer {settings.xai_api_key}"},
        json={"model": "grok-2-image", "prompt": prompt, "n": 1, "response_format": "b64_json"},
        timeout=120,
    )
    x.raise_for_status()
    base_b64 = x.json()["data"][0]["b64_json"]
    base_bytes = base64.b64decode(base_b64)

    # 2) Replicate face-swap (InstantID/Reactor) — set version pin in env in prod
    rep = httpx.post(
        "https://api.replicate.com/v1/predictions",
        headers={"Authorization": f"Token {settings.replicate_api_token}",
                 "Content-Type": "application/json"},
        json={
            "version": "REPLACE_WITH_INSTANTID_VERSION",
            "input": {
                "image": "data:image/png;base64," + base64.b64encode(base_bytes).decode(),
                "face_image": "data:image/png;base64," + base64.b64encode(ref_png).decode(),
            },
        },
        timeout=180,
    )
    rep.raise_for_status()
    out_url = rep.json()["output"]
    if isinstance(out_url, list):
        out_url = out_url[0]
    return httpx.get(out_url, timeout=120).content


def via_ohapi(prompt: str, character_ref_id: str) -> bytes:
    if not settings.ohapi_fallback_url or not settings.ohapi_fallback_key:
        raise RuntimeError("OhAPI fallback not configured")
    r = httpx.post(
        f"{settings.ohapi_fallback_url}/images/generate",
        headers={"Authorization": f"Bearer {settings.ohapi_fallback_key}"},
        json={"character_id": character_ref_id, "prompt": prompt},
        timeout=180,
    )
    r.raise_for_status()
    job = r.json()
    # Caller handles polling on the external service
    return base64.b64decode(job["image_b64"])
