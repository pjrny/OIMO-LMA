"""ComfyUI HTTP client.

Loads a workflow JSON template, injects the character reference image,
prompt, ControlNet pose and seed, then polls /history for the result.

Strategy B mapping:
  - SDXL/Pony NSFW checkpoint  -> KSampler
  - ControlNet OpenPose         -> scene pose
  - InstantID + IP-Adapter-FaceID -> identity injection (final step)
"""
from __future__ import annotations
import json, time, uuid
from pathlib import Path
import httpx
from app.core.config import settings

WORKFLOW_PATH = Path(__file__).parent.parent / "workflows" / "instantid_nsfw.json"


def _load_workflow() -> dict:
    with open(WORKFLOW_PATH) as f:
        return json.load(f)


def submit(prompt: str, ref_image_name: str, pose_name: str | None,
           width: int, height: int, seed: int, guidance: float) -> str:
    wf = _load_workflow()
    # Node IDs follow the shipped workflow template — keep stable.
    wf["6"]["inputs"]["text"] = prompt
    wf["10"]["inputs"]["image"] = ref_image_name           # InstantID reference
    wf["3"]["inputs"]["seed"] = seed
    wf["3"]["inputs"]["cfg"] = guidance
    wf["5"]["inputs"]["width"] = width
    wf["5"]["inputs"]["height"] = height
    if pose_name and "12" in wf:
        wf["12"]["inputs"]["image"] = pose_name            # ControlNet pose

    client_id = str(uuid.uuid4())
    r = httpx.post(f"{settings.comfyui_url}/prompt",
                   json={"prompt": wf, "client_id": client_id},
                   timeout=settings.comfyui_timeout)
    r.raise_for_status()
    return r.json()["prompt_id"]


def wait(prompt_id: str, poll_s: float = 1.5) -> bytes:
    deadline = time.time() + settings.comfyui_timeout
    while time.time() < deadline:
        h = httpx.get(f"{settings.comfyui_url}/history/{prompt_id}", timeout=10).json()
        if prompt_id in h:
            outputs = h[prompt_id]["outputs"]
            for node in outputs.values():
                for img in node.get("images", []):
                    img_r = httpx.get(
                        f"{settings.comfyui_url}/view",
                        params={"filename": img["filename"],
                                "subfolder": img.get("subfolder", ""),
                                "type": img.get("type", "output")},
                        timeout=30,
                    )
                    img_r.raise_for_status()
                    return img_r.content
        time.sleep(poll_s)
    raise TimeoutError("ComfyUI generation timed out")


def upload_image(name: str, data: bytes) -> str:
    r = httpx.post(
        f"{settings.comfyui_url}/upload/image",
        files={"image": (name, data, "image/png")},
        data={"overwrite": "true"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("name", name)
