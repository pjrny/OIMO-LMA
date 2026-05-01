from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.auth import require_user, Principal
from app.schemas.api import JobOut
from app.models.db_models import Job
from app.services import storage

router = APIRouter()


@router.get("/{job_id}/status", response_model=JobOut)
def job_status(
    job_id: str,
    db: Session = Depends(get_db),
    user: Principal = Depends(require_user),
):
    job = db.get(Job, job_id)
    if not job or job.owner_id != user.user_id:
        raise HTTPException(404, "Job not found")
    url = storage.presign(job.output_key) if job.output_key else None
    return JobOut(job_id=job.id, status=job.status, url=url,
                  provider=job.provider, error=job.error)
