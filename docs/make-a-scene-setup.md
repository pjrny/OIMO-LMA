# OIMO Make a Scene (Step 1) Setup Guide

This guide optimizes your **first launch step**: the Make a Scene user funnel.

## 1) Recommended Phase Plan

### Phase A (ship fastest)
- Keep your existing MAS UX flow.
- Route generation requests through your internal FastAPI service (`oimo_ohapi`) for orchestration.
- Use one production-safe image pipeline first (SFW), then add restricted modes behind verification controls.

### Phase B (harden + scale)
- Add queueing, job retries, and provider fallback logic.
- Add Odoo-backed verification level checks for feature gating.
- Add telemetry (latency, failover reasons, costs per generation).

## 2) Platforms/Accounts To Set Up

### Core product infra
- GitHub repo + GitHub Actions (CI, deployment checks)
- Cloud host for API (e.g., Fly.io/Render/AWS/GCP)
- PostgreSQL (managed)
- Redis (Celery queue broker/result backend)
- S3-compatible storage (AWS S3/Cloudflare R2/MinIO)

### Identity/Auth/Billing
- Odoo instance (source of truth for user + verification + monetization)
- JWT signing secret for token minting
- Optional: Stripe for card billing and wallet top-ups

### AI provider stack (orchestrated by FastAPI)
- Primary generator provider(s)
- Backup generator provider(s)
- Face/identity-preservation provider where policy-compliant

## 3) Variables To Add In GitHub

Add these as **GitHub Repository Secrets** (Actions/deploy) and environment variables in runtime.

### App core
- `ENV=production`
- `API_HOST`
- `API_PORT`
- `LOG_LEVEL`
- `JWT_SECRET`
- `JWT_ALG=HS256`
- `JWT_ISSUER=oimo-odoo`

### Database / queue
- `DATABASE_URL`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`

### Storage
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_REGION`
- `S3_USE_SSL=true`
- `S3_PUBLIC_BASE_URL`

### Odoo
- `ODOO_BASE_URL`
- `ODOO_DB`
- `ODOO_API_KEY` (preferred) or service credentials
- `ODOO_TIMEOUT_SECONDS=15`

### Provider routing (example pattern)
- `PROVIDER_PRIMARY`
- `PROVIDER_SECONDARY`
- `PROVIDER_TERTIARY`
- `PROVIDER_TIMEOUT_SECONDS`

### Optional UI vars
- `VITE_API_BASE_URL`
- `VITE_APP_NAME=OIMO Make a Scene`
- `VITE_TERMS_URL`

## 4) First-Step UX Flow (Make a Scene)

Target wireframe flow:
1. Passcode + Terms gate
2. Upload selfie(s)
3. Optional character combine
4. Optional QR URL
5. Scene picker (5 cards)
6. Generate
7. Poll job status + show progress
8. Success: download output + cooldown timer
9. Failure: show retry/fallback card

## 5) Data Contract for the UI

### Create character
`POST /api/v1/characters/create`
- input: images[]
- output: character_id, status

### Start generation
`POST /api/v1/images/generate`
- input: character_id, scene_id, prompt override (optional), width, height
- output: job_id

### Poll generation
`GET /api/v1/jobs/{job_id}/status`
- output: queued | running | completed | failed, plus URL/metadata when completed

## 6) Next Implementation Steps

1. **Wire frontend to API**: connect your existing MAS page to the three endpoints above.
2. **Add auth bridge**: mint Odoo-compatible JWT containing `verification_level`.
3. **Add feature gating**: restrict advanced generation routes by verification level.
4. **Enable storage + URLs**: return signed/public asset URLs from object storage.
5. **Set provider failover policy**: retry and switch provider by timeout/error class.
6. **Add observability**: capture success/failure rates and average render time by scene.
7. **Add cooldown enforcement**: server-side + client-side 60-second re-run lock.
8. **Run pilot**: small user cohort, collect prompt/scene QA data, then iterate.
