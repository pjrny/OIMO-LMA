# OIMO Internal OhAPI — FastAPI + Celery Skeleton

A drop-in replacement for OhAPI / Unclothy that runs on **your** GPU server.
Powers the OIMO Likeness/NSFW Engine and MAS V4.

> Mirrors OhAPI endpoints exactly so MAS V4 can swap providers by changing one base URL.

## Architecture

```
LMA Dashboard / MAS V4 Worker
        │  HTTPS
        ▼
┌──────────────────────────┐      ┌──────────────────┐
│  FastAPI  (this service) │─────▶│ Celery + Redis   │
│  /characters /images     │      │  worker pool     │
└────────────┬─────────────┘      └────────┬─────────┘
             │                              │
             ▼                              ▼
      Postgres (chars,         ComfyUI HTTP API
      jobs, embeddings)        (InstantID + IP-Adapter
                                + ControlNet OpenPose
                                + SDXL/Pony NSFW ckpt)
             │                              │
             └──────────► MinIO / S3 ◄──────┘
                       (refs + outputs)
```

Strategy B pipeline (matches your decision):
1. Text→NSFW base scene via SDXL/Pony checkpoint + ControlNet pose
2. Identity injected via InstantID (face swap as final step)
3. Output framed + QR overlay handled by MAS V4 worker (unchanged)

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/characters/create` | Upload 1–5 selfies → `character_id` |
| GET  | `/api/v1/characters/{id}/status` | Embedding ready? |
| POST | `/api/v1/images/generate` | Queue NSFW generation for a character |
| GET  | `/api/v1/jobs/{job_id}/status` | Poll job → returns presigned URL on success |
| POST | `/api/v1/webhooks/job` | Optional webhook callback registration |

All endpoints expect `Authorization: Bearer <OIMO_TOKEN>` issued by Odoo
(Level 2+ verification = create characters, Level 5+ KYC = higher rate limits).

## Quick start (local dev)

```bash
cp .env.example .env
docker compose up -d redis postgres minio
python -m pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8080
celery -A app.workers.celery_app worker --loglevel=info -Q gpu
```

Pointing MAS V4 at it — change the worker base URL only:
```js
const OHAPI_BASE = "https://ohapi.your-server.com/api/v1"; // was https://api.oh.xyz/v1
```

## Production GPU pod

Recommended: RunPod RTX 4090 / A6000 template with ComfyUI preinstalled.
Custom nodes required:
- `ComfyUI_IPAdapter_plus`
- `ComfyUI_InstantID`
- `comfyui_controlnet_aux`

Models (download once to pod volume):
- SDXL base + Juggernaut XL or Pony Diffusion V6 (NSFW checkpoint)
- InstantID `antelopev2` + `ip-adapter.bin`
- ControlNet OpenPose SDXL

Set `COMFYUI_URL=http://127.0.0.1:8188` in the worker env.

## Roadmap (post-MVP)

- Per-user LoRA fine-tuning for top creators
- Multi-character scenes
- Video (AnimateDiff / SVD)
- Auto-upload hand-off to Puppeteer agent (OnlyFans / PornHub)
- Odoo billing hook: emit `character_id`, GPU seconds, cost → 70% creator payout
