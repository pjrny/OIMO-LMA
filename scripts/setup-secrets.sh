#!/usr/bin/env bash
#
# setup-secrets.sh — Push every Argon Platform secret (blueprint section 2
# ledger) into Cloudflare's encrypted Worker secret store.
#
# Usage:
#   1. Copy scripts/secrets.local.example.sh to scripts/secrets.local.sh
#   2. Fill in your real values in scripts/secrets.local.sh (NEVER commit it)
#   3. From the repo root run:
#        source scripts/secrets.local.sh && bash scripts/setup-secrets.sh
#
# Requires: npx (Node.js), wrangler auth (`npx wrangler login`) or
# CLOUDFLARE_API_TOKEN exported in your environment.

set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: npx not found. Install Node.js first: https://nodejs.org" >&2
  exit 1
fi

# Secrets ledger (Argon Platform Deployment Blueprint, section 2).
# Each secret is read from an environment variable of the SAME NAME, so after
# sourcing secrets.local.sh every line below is fully non-interactive.
SECRETS=(
  ODOO_DATABASE_URL_1
  ODOO_API_URL_1
  ODOO_DATABASE_URL_2
  ODOO_API_URL_2
  CLOUDFLARE_WORKER_API_2
  CLOUDFLARE_WORKER_URL_2
  RUNPOD_API
  VAST_API
  MCP_LLM_CODE_LOCAL
  MCP_LLM_PICVIDEO_LOCAL
  CIVITAI_API
  STRIPE_API_1
  STRIPE_API_2
  STRIPE_API_3
  XXX_PAYMENTS_API_1
  METAMASK_WALLET_ADDRESS
  HaveIBeenPwned_API
  FaceCheckid_API
  PimEyes_API
  HudsonRock_API
  WhatsMyName_API
  Epieos_API
  Yoti_API
  Ondato_Age_Verification_API
  # Dual-Odoo MVP secrets (worker env bindings)
  XXXOOO_API_KEY
  XXXOOO_MCP_KEY
  XOXO_API_KEY
  GEMINI_API_KEY
  HIBP_API_KEY
  PASSCODE
)

echo "==> Pushing ${#SECRETS[@]} secrets to Cloudflare Worker secret store..."
echo "==> Make sure you have run 'npx wrangler login' (or exported CLOUDFLARE_API_TOKEN)."
echo

missing=0
for name in "${SECRETS[@]}"; do
  value="${!name:-}"
  if [ -z "${value}" ]; then
    echo "WARN: ${name} is empty — skipping (set it in scripts/secrets.local.sh to push it)"
    missing=$((missing + 1))
    continue
  fi
  echo "==> Pushing secret: ${name}"
  printf '%s' "${value}" | npx wrangler secret put "${name}"
done

echo
if [ "${missing}" -gt 0 ]; then
  echo "DONE with ${missing} skipped empty secret(s). Re-run after filling them in."
else
  echo "ALL secrets pushed. Verify with: npx wrangler secret list"
fi
echo "REMINDER: rotate the Odoo API keys after initial testing (see README SECURITY note)."
