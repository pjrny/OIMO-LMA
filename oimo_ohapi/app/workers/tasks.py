"""GPU worker tasks. Runs on the ComfyUI pod."""
from __future__ import annotations
import random, time
from datetime import datetime
from celery.utils.log import get_task_logger

from app.workers.celery_app import celery_app
from app.core.db import SessionLocal
from app.models.db_models import Job, Character
from app.services import comfy, fallback, storage

log = get_task_logger(__name__)


@celery_app.task(bind=True, name="generate_image", max_retries=2, default_retry_delay=10)
def generate_image(self, job_id: str):
    db = SessionLocal()
    try:
        job: Job | None = db.get(Job, job_id)
        if not job:
            log.error("job %s missing", job_id)
            return
        char: Character | None = db.get(Character, job.character_id)
        if not char or not char.reference_keys:
            _fail(db, job, "Character missing or has no reference image")
            return

        job.status = "running"
        job.updated_at = datetime.utcnow()
        db.commit()
        t0 = time.time()

        ref_key = char.reference_keys[0]
        ref_bytes = storage.s3_client().get_object(
            Bucket=storage.settings.s3_bucket, Key=ref_key
        )["Body"].read()

        seed = job.seed if job.seed is not None else random.randint(1, 2**31 - 1)
        img_bytes: bytes
        provider: str

        # 1) Internal ComfyUI (Strategy B primary)
        try:
            ref_name = comfy.upload_image(f"ref_{char.id}.png", ref_bytes)
            pose_name = None
            if job.controlnet_pose := getattr(job, "controlnet_pose", None):  # noqa
                pose_name = job.controlnet_pose
            prompt_id = comfy.submit(
                prompt=job.prompt, ref_image_name=ref_name, pose_name=pose_name,
                width=job.width, height=job.height, seed=seed, guidance=job.guidance,
            )
            img_bytes = comfy.wait(prompt_id)
            provider = "comfyui"
        except Exception as e:
            log.warning("ComfyUI failed (%s) — trying xAI+Replicate", e)
            try:
                img_bytes = fallback.via_xai_then_replicate(job.prompt, ref_bytes)
                provider = "xai+replicate"
            except Exception as e2:
                log.warning("xAI+Replicate failed (%s) — trying OhAPI", e2)
                img_bytes = fallback.via_ohapi(job.prompt, char.id)
                provider = "ohapi"

        out_key = f"outputs/{char.owner_id}/{job.id}.png"
        storage.put_bytes(out_key, img_bytes, "image/png")

        job.status = "succeeded"
        job.output_key = out_key
        job.provider = provider
        job.cost_seconds = time.time() - t0
        job.updated_at = datetime.utcnow()
        db.commit()
        log.info("job %s done via %s in %.1fs", job.id, provider, job.cost_seconds)

    except Exception as exc:
        log.exception("job %s crashed", job_id)
        try:
            job = db.get(Job, job_id)
            if job:
                _fail(db, job, str(exc)[:1900])
        finally:
            raise self.retry(exc=exc)
    finally:
        db.close()


def _fail(db, job: Job, msg: str):
    job.status = "failed"
    job.error = msg
    job.updated_at = datetime.utcnow()
    db.commit()
