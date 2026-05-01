"""MAS V4 scene library.

Maps the 5 launch cinematic scenes to: (a) NSFW prompt template for the
text-to-base step, (b) ControlNet OpenPose reference filename uploaded to
ComfyUI's input/ folder. Add poses for your full 25+ position library here.
"""
from typing import Tuple

SCENES: dict[str, dict] = {
    "noir_alley": {
        "prompt": (
            "cinematic noir alley at night, neon reflections in puddles, "
            "rain-soaked cobblestone, single figure in moody chiaroscuro, "
            "shallow depth of field, anamorphic lens, 35mm film grain, "
            "ultra detailed skin, photorealistic"
        ),
        "pose": "pose_noir_standing.png",
    },
    "velvet_lounge": {
        "prompt": (
            "luxury velvet lounge interior, deep red curtains, brass fixtures, "
            "warm tungsten key light, soft rim, intimate composition, editorial fashion lighting"
        ),
        "pose": "pose_lounge_seated.png",
    },
    "rooftop_dusk": {
        "prompt": (
            "rooftop at golden-hour dusk, distant city skyline bokeh, warm sunset rim light, "
            "wind in hair, high fashion editorial, photorealistic"
        ),
        "pose": "pose_rooftop_lean.png",
    },
    "studio_silk": {
        "prompt": (
            "minimal photo studio, off-white silk backdrop, large softbox key, "
            "subtle hair light, clean editorial portrait, hyperreal skin texture"
        ),
        "pose": "pose_studio_pose1.png",
    },
    "moonlit_pool": {
        "prompt": (
            "moonlit infinity pool, water caustics, cool teal moonlight, warm poolside lanterns, "
            "cinematic widescreen, photorealistic"
        ),
        "pose": "pose_pool_recline.png",
    },
}

# Strict identity preservation suffix appended to every scene prompt.
IDENTITY_SUFFIX = (
    " Preserve exact facial identity, jawline and eye color from the reference. "
    "Do not merge with another actor. High fidelity skin micro-detail. "
    "Composition matches the provided pose reference exactly."
)


def resolve_scene(scene_id: str | None, fallback_prompt: str,
                  override_pose: str | None) -> Tuple[str, str | None]:
    if scene_id and scene_id in SCENES:
        s = SCENES[scene_id]
        return s["prompt"] + IDENTITY_SUFFIX, override_pose or s["pose"]
    return fallback_prompt + IDENTITY_SUFFIX, override_pose
