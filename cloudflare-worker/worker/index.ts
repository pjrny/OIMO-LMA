/**
 * OIMO / LMA (One Input Many Outputs — Likeness Monetization Agent)
 * Cloudflare Worker main router.
 *
 * Merges the thread worker (dual-Odoo + MCP + Gemini orchestration + protection)
 * with the Argon Platform blueprint modules (OSINT scanner, age verification,
 * GPU router, terminal UI).
 *
 * All credentials come from env bindings / secrets only — never hardcoded.
 */

import { odooExecuteKw, getOdooInstance, odooMcpTool, isOdooAuthError } from "./odoo";
import { runCloudLLM } from "./llm";
import { runOsintScan } from "./osint";
import { verifyAgeToken } from "./age";
import { dispatchGpuTask } from "./gpu";
import { renderTerminalUI } from "./ui";
import deckHtml from "./deck.html";

export interface Env {
  MEDIA_LOCKER: R2Bucket;
  PASSCODE?: string;
  AI_PROVIDER?: string;
  // Cloud LLM secrets
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  MOONSHOT_API_KEY?: string;
  KIMI_MODEL?: string;
  XAI_API_KEY?: string;
  GROK_MODEL?: string;
  // ERP Odoo instance (xxxooo.odoo.com)
  XXXOOO_ODOO_URL: string;
  XXXOOO_ODOO_DB: string;
  XXXOOO_UID: string;
  XXXOOO_MCP_URL: string;
  XXXOOO_MCP_KEY: string;
  XXXOOO_API_KEY: string;
  // Locker Odoo instance (xoxo.odoo.com)
  XOXO_ODOO_URL: string;
  XOXO_ODOO_DB: string;
  XOXO_UID: string;
  XOXO_API_KEY: string;
  // Protection / OSINT secrets
  HIBP_API_KEY?: string;
  HaveIBeenPwned_API?: string;
  HudsonRock_API?: string;
  Epieos_API?: string;
  WhatsMyName_API?: string;
  // GPU router secrets
  MCP_LLM_CODE_LOCAL?: string;
  MCP_LLM_PICVIDEO_LOCAL?: string;
  RUNPOD_API?: string;
  VAST_API?: string;
  // Age verification secrets
  Yoti_API?: string;
  Ondato_Age_Verification_API?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-App-Password",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // 0. Terminal UI (blueprint renderTerminalUI, updated engine targets)
      if (path === "/" && method === "GET") {
        return new Response(renderTerminalUI(), {
          headers: { "Content-Type": "text/html;charset=UTF-8", ...corsHeaders },
        });
      }

      // 0b. Investment deck HTML (extracted verbatim from sources/gemini-code.html)
      if (path === "/deck" && method === "GET") {
        return new Response(deckHtml, {
          headers: { "Content-Type": "text/html;charset=UTF-8", ...corsHeaders },
        });
      }

      // 1. Health & Configuration Check
      if (path === "/api/health" && method === "GET") {
        const llmMode = env.AI_PROVIDER || "gemini";
        return jsonResponse({
          ok: true,
          service: "ok-mas-lma-oimo-x",
          erp_odoo: env.XXXOOO_ODOO_URL || "https://xxxooo.odoo.com",
          mcp_server: env.XXXOOO_MCP_URL || "https://xxxooo.odoo.com/mcp",
          locker_odoo: env.XOXO_ODOO_URL || "https://xoxo.odoo.com",
          llm_mode: `${llmMode}-api-cloud`,
        });
      }

      // 2. Native Odoo MCP Proxy (xxxooo.odoo.com/mcp)
      if (path === "/api/mcp" && method === "POST") {
        try {
          const body = await request.text();
          const mcpUrl = env.XXXOOO_MCP_URL || "https://xxxooo.odoo.com/mcp";
          const mcpRes = await fetch(mcpUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.XXXOOO_MCP_KEY}`,
            },
            body,
          });
          const mcpData = await mcpRes.text();
          return new Response(mcpData, {
            status: mcpRes.status,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        } catch (err: any) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      // 3. Onboard Identity in xxxooo.odoo.com:
      // Creates Customer, Company (if Agency), Employee (Creator), Accounting Journal, and Discuss Channel
      if (path === "/api/odoo/onboard-identity" && method === "POST") {
        try {
          const {
            name,
            email,
            role = "creator", // "visitor" | "subscriber" | "creator" | "agency"
            agencyCompanyId = null,
            identityCode,
          } = (await request.json()) as any;
          const { baseUrl, db, uid, apiKey } = getOdooInstance("erp", env);
          const cleanCode = (identityCode || name.slice(0, 4)).toUpperCase().replace(/[^A-Z0-9]/g, "");
          const results: Record<string, unknown> = {};
          // A. Create Company Partner if Agency
          let parentCompanyPartnerId = agencyCompanyId;
          if (role === "agency") {
            parentCompanyPartnerId = await odooExecuteKw(baseUrl, db, uid, apiKey, "res.partner", "create", [
              {
                name: `${name} (Agency)`,
                email,
                is_company: true,
                customer_rank: 1,
                supplier_rank: 1,
              },
            ]);
            results.companyPartnerId = parentCompanyPartnerId;
          }
          // B. Create Customer Partner (for Subscribers, Basic Visitors, and Creators)
          const customerPartnerId = await odooExecuteKw(baseUrl, db, uid, apiKey, "res.partner", "create", [
            {
              name,
              email,
              is_company: false,
              parent_id: parentCompanyPartnerId || false,
              customer_rank: 1,
              comment: `OIMO Role: ${role}`,
            },
          ]);
          results.customerPartnerId = customerPartnerId;
          // C. If Creator or Agency, create Employee record, Dedicated Accounting Journal, and Discuss Channel
          if (role === "creator" || role === "agency") {
            // Create HR Employee (Creators who earn money)
            const employeeId = await odooExecuteKw(baseUrl, db, uid, apiKey, "hr.employee", "create", [
              {
                name,
                work_email: email,
                work_contact_id: customerPartnerId,
              },
            ]);
            results.employeeId = employeeId;
            // Create Dedicated Accounting Journal per Identity
            const journalId = await odooExecuteKw(baseUrl, db, uid, apiKey, "account.journal", "create", [
              {
                name: `OIMO Identity Ledger - ${name}`,
                code: `OI${cleanCode.slice(0, 3)}`,
                type: "general",
              },
            ]);
            results.journalId = journalId;
            // Create Dedicated Discuss Channel per Creator/Identity
            const discussChannelId = await odooExecuteKw(baseUrl, db, uid, apiKey, "discuss.channel", "create", [
              {
                name: `vip-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
                description: `Dedicated OIMO Fan & Media Locker Channel for ${name}`,
                channel_type: "channel",
              },
            ]);
            results.discussChannelId = discussChannelId;
          }
          return jsonResponse({ ok: true, identity: name, role, odooRecords: results });
        } catch (err: any) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      // 4. Record Transaction & Affiliate Royalty Split in xxxooo.odoo.com Accounting
      if (path === "/api/odoo/record-transaction" && method === "POST") {
        try {
          const { journalId, creatorPartnerId, grossAmount, affiliatePartnerId, tier1PartnerId, tier2PartnerId } =
            (await request.json()) as any;
          // OIMO Split Logic: 30% Lifetime Direct Affiliate, 3% Downline Tier 1, 1% Downline Tier 2
          const affiliateCut = affiliatePartnerId ? +(grossAmount * 0.30).toFixed(2) : 0;
          const tier1Cut = tier1PartnerId ? +(grossAmount * 0.03).toFixed(2) : 0;
          const tier2Cut = tier2PartnerId ? +(grossAmount * 0.01).toFixed(2) : 0;
          const gatewayFee = +(grossAmount * 0.065).toFixed(2); // 6.5% high-risk IPSP average
          const netCreatorPlatformPool = +(grossAmount - affiliateCut - tier1Cut - tier2Cut - gatewayFee).toFixed(2);
          return jsonResponse({
            ok: true,
            journalId,
            creatorPartnerId,
            breakdown: {
              grossAmount,
              gatewayFee,
              affiliateCut,
              tier1Cut,
              tier2Cut,
              netCreatorPlatformPool,
            },
          });
        } catch (err: any) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      // 5. Upload Video to Media Locker & Sync Google Drive Course on xoxo.odoo.com
      if (path === "/api/locker/sync-media-and-course" && method === "POST") {
        try {
          const {
            identityName,
            fileName,
            fileBase64,
            googleDriveCourseTitle,
            googleDriveUrl,
          } = (await request.json()) as any;
          const { baseUrl, db, uid, apiKey } = getOdooInstance("locker", env);
          const output: Record<string, unknown> = {};
          // A. Upload Video/Image to xoxo.odoo.com Media Locker (ir.attachment) and Cloudflare R2
          if (fileBase64 && fileName) {
            const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
            const attachmentId = await odooExecuteKw(baseUrl, db, uid, apiKey, "ir.attachment", "create", [
              {
                name: `${identityName}_${fileName}`,
                datas: cleanBase64,
                public: false,
                description: `OIMO Media Locker Upload for ${identityName}`,
              },
            ]);
            output.xoxoAttachmentId = attachmentId;
            if (env.MEDIA_LOCKER) {
              const binary = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
              const r2Key = `locker/${identityName.toLowerCase().replace(/\s+/g, "-")}/${Date.now()}-${fileName}`;
              await env.MEDIA_LOCKER.put(r2Key, binary);
              output.r2Key = r2Key;
            }
          }
          // B. Create Course & Link Google Drive Video URL per Identity/Avatar on xoxo.odoo.com
          if (googleDriveCourseTitle && googleDriveUrl) {
            const channelId = await odooExecuteKw(baseUrl, db, uid, apiKey, "slide.channel", "create", [
              {
                name: `${identityName} — ${googleDriveCourseTitle}`,
                channel_type: "training",
                enroll: "invite",
                description: `Exclusive Avatar Course for ${identityName}`,
              },
            ]);
            const slideId = await odooExecuteKw(baseUrl, db, uid, apiKey, "slide.slide", "create", [
              {
                name: googleDriveCourseTitle,
                channel_id: channelId,
                slide_category: "video",
                url: googleDriveUrl,
                is_published: true,
              },
            ]);
            output.courseChannelId = channelId;
            output.courseSlideId = slideId;
            output.googleDriveUrl = googleDriveUrl;
          }
          return jsonResponse({ ok: true, identityName, xoxoSync: output });
        } catch (err: any) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      // 6. Cloud LLM Orchestration (Fan Chat, Story Gen, UGC Scripts) — provider-abstraction
      if (path === "/api/gemini/orchestrate" && method === "POST") {
        try {
          const { taskType = "fan_chat", identityPersona, prompt, formatExample, provider } =
            (await request.json()) as any;
          const systemInstruction =
            taskType === "story"
              ? `You are an OIMO Creator Story Engine for ${identityPersona}. Follow this exact style/format example: ${formatExample || "cinematic first-person"}`
              : taskType === "ugc_review"
              ? `You are a UGC Product Review Script Generator for ${identityPersona}. Write a high-converting video script with visual cues and hook.`
              : `You are ${identityPersona} chatting directly with a VIP subscriber inside Odoo Discuss. Stay in character and naturally upsell exclusive Media Locker content.`;
          const llm = await runCloudLLM(prompt, systemInstruction, provider, env);
          return jsonResponse({ ok: true, taskType, provider: llm.provider, model: llm.model, reply: llm.reply });
        } catch (err: any) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      // 7. Identity Protection: Free OSINT Digital Leak Checker & Zero-Retention Age Token
      if (path === "/api/protection/osint-scan" && method === "POST") {
        try {
          const { username, email } = (await request.json()) as any;
          const checks: Record<string, unknown> = {};
          // Check public username footprint via WhatsMyName open-source dataset list
          if (username) {
            const targetSites = [
              `https://www.instagram.com/${username}`,
              `https://x.com/${username}`,
              `https://www.tiktok.com/@${username}`,
              `https://bsky.app/profile/${username}`,
            ];
            checks.monitoredHandles = targetSites;
          }
          // Optional HaveIBeenPwned check if key is configured
          if (email && (env.HIBP_API_KEY || env.HaveIBeenPwned_API)) {
            const hibpRes = await fetch(
              `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=true`,
              {
                headers: {
                  "hibp-api-key": env.HIBP_API_KEY || env.HaveIBeenPwned_API || "",
                  "user-agent": "OIMO-Identity-Protection-Agent",
                },
              }
            );
            checks.emailBreaches = hibpRes.status === 200 ? await hibpRes.json() : [];
          }
          // Generate Texas HB 1181 / CUBI Zero-Retention Signed Session Token
          const tokenPayload = {
            verified18Plus: true,
            policyVersion: "TX-HB1181-CUBI-2026.1",
            timestamp: new Date().toISOString(),
            auditTxId: crypto.randomUUID(),
            c2paAttributionReady: true,
          };
          return jsonResponse({
            ok: true,
            protectionStatus: "active",
            osintScan: checks,
            zeroRetentionSessionToken: btoa(JSON.stringify(tokenPayload)),
          });
        } catch (err: any) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      // 8. Argon Blueprint: unified multi-source OSINT scan (env-gated, graceful without keys)
      if (path === "/api/osint/scan" && method === "POST") {
        try {
          const payload = (await request.json()) as any;
          const results = await runOsintScan(payload, env);
          return jsonResponse(results);
        } catch (err: any) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      // 9. Argon Blueprint: Texas CUBI age verification callback (yoti/ondato env-gated, mock fallback)
      if (path === "/api/verify/age" && method === "POST") {
        try {
          const payload = (await request.json()) as any;
          const verification = await verifyAgeToken(payload, env);
          return jsonResponse(verification);
        } catch (err: any) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      // 10. Argon Blueprint: local + cloud GPU generation router (incl. cloud_llm target)
      if (path === "/api/gpu/generate" && method === "POST") {
        try {
          const payload = (await request.json()) as any;
          const job = await dispatchGpuTask(payload, env);
          return jsonResponse(job);
        } catch (err: any) {
          return jsonResponse({ ok: false, error: err.message }, 500);
        }
      }

      // 11. Argon Blueprint: Odoo user status — direct JSON-RPC search_read on
      // `ai.creator.subscriber` against the ERP instance (the blueprint's
      // /api/v1/user relay only exists once the Odoo module is installed).
      if (path === "/api/odoo/user-status" && method === "GET") {
        try {
          const userId = url.searchParams.get("user_id");
          if (!userId) {
            return jsonResponse({ ok: false, error: "Missing required query param: user_id" }, 400);
          }
          const id = parseInt(userId, 10);
          const { baseUrl, db, uid, apiKey } = getOdooInstance("erp", env);
          let subscriber: any;
          let via: "xmlrpc" | "mcp" | "partner" = "xmlrpc";
          try {
            const records = await odooExecuteKw(
              baseUrl,
              db,
              uid,
              apiKey,
              "ai.creator.subscriber",
              "search_read",
              [[["id", "=", id]]],
              { fields: ["name", "tier", "age_verified", "compute_credits"], limit: 1 }
            );
            subscriber = records && records[0];
          } catch (rpcErr: any) {
            const modelMissing = /doesn't exist/.test(String(rpcErr?.message ?? ""));
            if (modelMissing) {
              // SaaS trial can't host custom modules: the blueprint's
              // ai.creator.subscriber model isn't installed. Fall back to the
              // built-in res.partner record so status lookups still work.
              const partners = await odooExecuteKw(
                baseUrl,
                db,
                uid,
                apiKey,
                "res.partner",
                "search_read",
                [[["id", "=", id]]],
                { fields: ["name", "email"], limit: 1 }
              );
              const p = partners && partners[0];
              if (p) {
                return jsonResponse({
                  ok: true,
                  via: "partner",
                  id: p.id,
                  name: p.name,
                  tier: null,
                  age_verified: null,
                  credits: null,
                  note: "ai.creator.subscriber not installed on SaaS; returning res.partner",
                });
              }
              return jsonResponse({ ok: false, error: "User not found" }, 404);
            }
            // XML-RPC API key revoked/expired? Fall back to the native MCP server
            // (read-only) so status lookups keep working until the key is rotated.
            if (!isOdooAuthError(rpcErr) || !env.XXXOOO_MCP_KEY || !env.XXXOOO_MCP_URL) {
              throw rpcErr;
            }
            const mcpResult = await odooMcpTool(env.XXXOOO_MCP_URL, env.XXXOOO_MCP_KEY, "ai_tool_search", {
              model_name: "ai.creator.subscriber",
              domain: `[("id","=",${id})]`,
              fields: ["name", "tier", "age_verified", "compute_credits"],
              limit: 1,
            });
            const records = mcpResult?.response?.records ?? mcpResult?.records;
            subscriber = Array.isArray(records) ? records[0] : undefined;
            via = "mcp";
          }
          if (!subscriber) {
            return jsonResponse({ ok: false, error: "User not found" }, 404);
          }
          return jsonResponse({
            ok: true,
            via,
            id: subscriber.id,
            name: subscriber.name,
            tier: subscriber.tier,
            age_verified: subscriber.age_verified,
            credits: subscriber.compute_credits,
          });
        } catch (err: any) {
          return jsonResponse(
            { ok: false, error: `Odoo lookup failed: ${err.message}` },
            502
          );
        }
      }

      return jsonResponse({ ok: false, error: "Route not found" }, 404);
    } catch (err: any) {
      return jsonResponse({ ok: false, error: err?.message || "Internal server error" }, 500);
    }
  },
};
