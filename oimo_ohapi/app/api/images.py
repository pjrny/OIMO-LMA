import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import require_level, Principal
from app.schemas.api import GenerateIn, JobOut
from app.models.db_models import Character, Job
from app.workers.tasks import generate_image
from app.services.scene_prompts import resolve_scene

router = APIRouter()


@router.post("/generate", response_model=JobOut)
def generate(
    body: GenerateIn,
    db: Session = Depends(get_db),
    user: Principal = Depends(require_level(2)),
):
    char = db.get(Character, body.character_id)
    if not char or char.owner_id != user.user_id:
        raise HTTPException(404, "Character not found")
    if char.status != "ready":
        raise HTTPException(409, f"Character status={char.status}")

    prompt, pose = resolve_scene(body.scene_id, body.prompt, body.controlnet_pose)

    job = Job(
        id=str(uuid.uuid4()),
        owner_id=user.user_id,
        character_id=char.id,
        scene_id=body.scene_id,
        prompt=prompt,
        width=body.width,
        height=body.height,
        seed=body.seed,
        guidance=body.guidance,
        status="queued",
    )
    # stash pose on the job object for the worker
    setattr(job, "controlnet_pose", pose)
    db.add(job)
    db.commit()

    generate_image.apply_async(args=[job.id], queue="gpu")
    return JobOut(job_id=job.id, status=job.status)
