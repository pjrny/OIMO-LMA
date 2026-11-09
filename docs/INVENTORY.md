# OIMO / LMA Platform Inventory
> Canonical platform inventory — reviewed 2026-11-09. One source of truth for
> accounts, deployments, URLs, and retirement candidates. Update on every add/remove.

## 1. Cloudflare Accounts

| Account ID | Role | Login | Notes |
|---|---|---|---|
| `6c5f8a2e10e1f65fa308bafb1583cf89` | **CANONICAL (main)** | message@pjrny.com (OAuth: Oscar@snogostraws.com) | All new OIMO/LMA work lands here. wrangler CLI authenticated. |
| `0adfeaaccd1d2cfa389d7bcd33b55ee4` | Support (AssetID + promo sites) | message@pjrny.com dashboard | workers.dev subdomain: `message-0ad.workers.dev`. No CLI auth. |

## 2. Workers

### Canonical account (6c5)
| Worker | URL | Repo | Status |
|---|---|---|---|
| `ok-mas-lma-oimo-x` | https://ok-mas-lma-oimo-x.oscar-6c5.workers.dev | [pjrny/OIMO-LMA](https://github.com/pjrny/OIMO-LMA) | **CANONICAL API worker** — Odoo ERP+locker, identity ladder L0-L8, AssetID proxy, MAS/grok generation. |

### Support account (0adf, subdomain `message-0ad.workers.dev`)
| Worker | URL | Repo | Status |
|---|---|---|---|
| `assetidprotocol` | https://assetidprotocol.message-0ad.workers.dev | pjrny/AssetIDProtocol (MIT) | **CANONICAL AssetID registry** (D1 `asset-registry` + R2 `asset-passport-files` + Queue). |
| `assetidprotocolrecognizer` | https://assetidprotocolrecognizer.message-0ad.workers.dev | pjrny/AssetIDProtocolRecognizer (MIT) | Visual matcher (pHash/dHash/HSV), service-bound to registry. |
| `authentic-human-co` | https://authentic-human-co.message-0ad.workers.dev | pjrny/authentichuman (Rust) | Promo site. |
| `verifyoimomas` | https://verifyoimomas.message-0ad.workers.dev | *(none found)* | ⚠️ STUB ("Hello World") — **retire or rebuild**. Identity ladder now lives in the canonical worker. |
| `events-patronjourney`, `worldflix-player`, `acting-journey`, `voidcity` | *.message-0ad.workers.dev | various | Side projects, unrelated. |

## 3. GitHub Repos

| Repo | Role | Status |
|---|---|---|
| [pjrny/OIMO-LMA](https://github.com/pjrny/OIMO-LMA) | **CANONICAL codebase** (this repo) | Active. Worker auto-deploy candidate. |
| pjrny/AssetIDProtocol | AssetID registry worker | Active (deployed from it). |
| pjrny/AssetIDProtocolRecognizer | Recognizer worker | Active. |
| pjrny/authentichuman | Promo site (Rust) | Active. |
| pjrny/GMAS-OIMO | Candidate "main" (per founder) | Stale (2026-10-26) — consolidate INTO OIMO-LMA or document as landing page. |
| pjrny/mas-lma-oimo-ok | Grok Build attempt | Mined for MAS generator; **no license file** — do not copy more than the ported core. |
| pjrny/odoojourney | Odoo exploration | Reference only. |
| atxdelay/0000000000001 | Founder's preferred repo | **Private/inaccessible** — either make public or mirror into pjrny/OIMO-LMA. |
| pjrny/LMA_Preview | Old preview | **Retire candidate** (stale 2025-11). |

## 4. Storage

| Resource | Account | Binding | Purpose |
|---|---|---|---|
| R2 `lma-mas-media` | 6c5 | `MEDIA_LOCKER` | Media locker + identity evidence (`identity-evidence/` prefix). |
| D1 `oimo-identity` (`04758dc1-3a57-4b19-b311-dfe6dc37eaad`) | 6c5 | `IDENTITY_DB` | Identity ladder + protected outputs. |
| R2 `asset-passport-files` | 0adf | `ASSET_FILES` | AssetID master files. |
| D1 `asset-registry` | 0adf | `DB` | AssetID registry + sightings. |

## 5. Odoo (odoo.com SaaS, account atx.delay@gmail.com)

| DB | URL | Role | Status |
|---|---|---|---|
| `xxxooo` (company XXXOOO) | https://xxxooo.odoo.com | **ERP** — partners, accounting, MCP | Active. API key live (secret `XXXOOO_API_KEY`). |
| `xoxoxo` (company xoxo) | https://xoxoxo.odoo.com | **Locker/LMS** — attachments, courses | Active. API key live (secret `XOXO_API_KEY`). |
| ~~`xoxo`~~ | ~~https://xoxo.odoo.com~~ | — | **DEAD** ("does not exist"). Purged from all configs. |

## 6. URLs — Canonical vs Dead

| URL | Verdict |
|---|---|
| https://ok-mas-lma-oimo-x.oscar-6c5.workers.dev | **CANONICAL API** |
| https://assetidprotocol.message-0ad.workers.dev | **CANONICAL registry** |
| https://assetidprotocolrecognizer.message-0ad.workers.dev | **CANONICAL recognizer** |
| ~~https://assetidprotocol.message-0adf.workers.dev~~ | **DEAD URL** (screenshot truncation error; never existed) |
| ~~https://xoxo.odoo.com~~ | **DEAD** |

## 7. Secrets on canonical worker (names only)

`XXXOOO_API_KEY`, `XXXOOO_MCP_KEY`, `XOXO_API_KEY`, `GEMINI_API_KEY`, `GEMINI_GOOGLE_API_KEY`,
`VERTEX_GOOGLE_API_KEY`, `XAI_LMA_API_KEY`, `CIVITAI_API_XOXO`, `ELEVENLABS_API_XOXO`,
`RUNPOD_API_ATX_XOXO_2`, `RUNPOD_API_META_XOXO`, `PASSCODE`.

## 8. Retirement / consolidation actions

1. **Retire** `verifyoimomas` worker (empty stub; superseded by canonical identity ladder) — needs 0adf dashboard access.
2. **Retire or repurpose** pjrny/LMA_Preview.
3. **Decide** GMAS-OIMO vs OIMO-LMA as "main" face; currently OIMO-LMA holds all code.
4. **Mirror or open** atxdelay/0000000000001, or abandon in favor of OIMO-LMA.
5. Add GitHub Action deploy for OIMO-LMA (workflow file in `.github/workflows/`; needs `CLOUDFLARE_API_TOKEN` repo secret).
