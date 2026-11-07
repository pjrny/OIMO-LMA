# ============================================================================
# secrets.local.example.sh — LOCAL SECRET VALUES FOR scripts/setup-secrets.sh
#
# !!! NEVER COMMIT THIS FILE !!!
# Copy to scripts/secrets.local.sh, fill in real values, keep it out of git:
#     cp scripts/secrets.local.example.sh scripts/secrets.local.sh
# Then push all secrets to Cloudflare:
#     source scripts/secrets.local.sh && bash scripts/setup-secrets.sh
#
# The .gitignore (handled separately) must exclude scripts/secrets.local.sh.
# Rotate the Odoo API keys after initial testing.
# ============================================================================

# ---- Non-sensitive Odoo instance URLs (prefilled, safe to keep) ----
XXXOOO_ODOO_URL="https://xxxooo.odoo.com"
XXXOOO_ODOO_DB="xxxooo"
XXXOOO_UID="2"
XXXOOO_MCP_URL="https://xxxooo.odoo.com/mcp"
XOXO_ODOO_URL="https://xoxo.odoo.com"
XOXO_ODOO_DB="xoxo"
XOXO_UID="2"

# ---- Secrets: Blueprint section 2 ledger (fill in, never commit) ----
ODOO_DATABASE_URL_1=""
ODOO_API_URL_1=""
ODOO_DATABASE_URL_2=""
ODOO_API_URL_2=""
CLOUDFLARE_WORKER_API_2=""
CLOUDFLARE_WORKER_URL_2=""
RUNPOD_API=""
VAST_API=""
MCP_LLM_CODE_LOCAL=""
MCP_LLM_PICVIDEO_LOCAL=""
CIVITAI_API=""
STRIPE_API_1=""
STRIPE_API_2=""
STRIPE_API_3=""
XXX_PAYMENTS_API_1=""
METAMASK_WALLET_ADDRESS=""
HaveIBeenPwned_API=""
FaceCheckid_API=""
PimEyes_API=""
HudsonRock_API=""
WhatsMyName_API=""
Epieos_API=""
Yoti_API=""
Ondato_Age_Verification_API=""

# ---- Secrets: Dual-Odoo MVP worker bindings (fill in, never commit) ----
XXXOOO_API_KEY=""
XXXOOO_MCP_KEY=""
XOXO_API_KEY=""
GEMINI_API_KEY=""
HIBP_API_KEY=""
PASSCODE=""
