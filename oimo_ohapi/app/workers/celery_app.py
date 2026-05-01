from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "oimo_ohapi",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_default_queue="gpu",
    task_track_started=True,
    result_expires=3600,
)
