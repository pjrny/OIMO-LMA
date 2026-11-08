/**
 * Identity verification ladder (Levels 0-8) — "verify once, many outputs".
 *
 * Ladder (from the OIMO/LMA plan):
 *   0 email               — Odoo res.partner exists on the ERP (xxxooo)
 *   1 selfie              — photo evidence (R2 + sha256, optional AssetID)
 *   2 liveness            — short video / body-liveness evidence
 *   3 gov_id              — government ID document (provider pluggable later)
 *   4 consent             — CV: recorded consent statement
 *   5 socials             — OSINT cross-check + self-attested handles
 *   6 therapist           — therapist session attestation (admin-reviewed)
 *   7 twin flame          — twin-flame counterparty attestation (admin-reviewed)
 *   8 verified            — computed badge when 0..7 are all approved
 *
 * Levels 0-5 auto-approve once valid evidence is hashed and stored; levels
 * 6-7 stay pending until an admin (PASSCODE) reviews. All evidence lives in
 * R2 under identity-evidence/ and its sha256 in D1 — evidence is auditable
 * and tamper-evident, and can be registered with the AssetID protocol.
 */

export interface IdentityEnv {
  IDENTITY_DB: D1Database;
  MEDIA_LOCKER?: R2Bucket;
  PASSCODE?: string;
  XXXOOO_ODOO_URL?: string;
  XXXOOO_ODOO_DB?: string;
  XXXOOO_UID?: string;
  XXXOOO_API_KEY?: string;
}

export interface LadderRung {
  level: number;
  key: string;
  title: string;
  evidence: "odoo" | "file" | "json" | "review";
  mimePrefixes?: string[];
  autoApprove: boolean;
  description: string;
}

export const LADDER: LadderRung[] = [
  { level: 0, key: "email", title: "Email (Odoo)", evidence: "odoo", autoApprove: true,
    description: "Identity enrolled and matched to an Odoo res.partner on the ERP." },
  { level: 1, key: "selfie", title: "Selfie", evidence: "file", mimePrefixes: ["image/"], autoApprove: true,
    description: "A current photo of the person; stored hashed, optionally AssetID-registered." },
  { level: 2, key: "liveness", title: "Video / Body Liveness", evidence: "file", mimePrefixes: ["video/", "image/"], autoApprove: true,
    description: "Short liveness video or motion capture; provider pluggable." },
  { level: 3, key: "gov_id", title: "Government ID", evidence: "file", mimePrefixes: ["image/", "application/pdf"], autoApprove: true,
    description: "Government-issued ID document; age/KYC provider pluggable (Yoti/Ondato)." },
  { level: 4, key: "consent", title: "Consent Statement (CV)", evidence: "file", mimePrefixes: ["video/", "audio/", "image/", "application/pdf"], autoApprove: true,
    description: "Recorded consent: the person states what likeness use they approve." },
  { level: 5, key: "socials", title: "Socials / OSINT", evidence: "json", autoApprove: true,
    description: "Self-attested handles cross-checked by the OSINT scanner when keys are configured." },
  { level: 6, key: "therapist", title: "Therapist Session", evidence: "review", autoApprove: false,
    description: "Licensed-therapist attestation of informed, voluntary participation." },
  { level: 7, key: "twinflame", title: "Twin Flame", evidence: "review", autoApprove: false,
    description: "Twin-flame / counterparty co-verification; admin-reviewed." },
];

export function ladderPublic() {
  return LADDER.map((r) => ({
    level: r.level, key: r.key, title: r.title,
    autoApprove: r.autoApprove, description: r.description,
  }));
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Find the Odoo res.partner id for an email on the ERP (level-0 proof). */
async function odooPartnerId(email: string, env: IdentityEnv): Promise<number | null> {
  const base = (env.XXXOOO_ODOO_URL || "https://xxxooo.odoo.com").replace(/\/$/, "");
  const db = env.XXXOOO_ODOO_DB || "xxxooo";
  const uid = parseInt(env.XXXOOO_UID || "2", 10);
  if (!env.XXXOOO_API_KEY) return null;
  const res = await fetch(`${base}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call",
      params: {
        service: "object", method: "execute_kw",
        args: [db, uid, env.XXXOOO_API_KEY, "res.partner", "search_read",
          [[["email", "=", email]]], { fields: ["id", "name"], limit: 1 }],
      },
      id: Date.now(),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data: any = await res.json();
  const rec = data?.result?.[0];
  return rec ? rec.id : null;
}

/** Create (or fetch) the identity record; verifies level 0 against Odoo. */
export async function enrollIdentity(name: string, email: string, env: IdentityEnv) {
  const existing = await env.IDENTITY_DB.prepare(
    "SELECT * FROM identities WHERE email = ?"
  ).bind(email).first<any>();
  if (existing) return { identity: existing, created: false };

  const partnerId = await odooPartnerId(email, env);
  const level = partnerId !== null ? 0 : -1;
  const res = await env.IDENTITY_DB.prepare(
    `INSERT INTO identities (partner_id, email, name, level) VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO NOTHING`
  ).bind(partnerId, email, name, level).run();
  const identity = await env.IDENTITY_DB.prepare(
    "SELECT * FROM identities WHERE email = ?"
  ).bind(email).first<any>();
  if (partnerId !== null) {
    await env.IDENTITY_DB.prepare(
      `INSERT INTO level_evidence (identity_id, level, kind, payload, decision, reviewed_at, reviewer)
       VALUES (?, 0, 'email', ?, 'approved', datetime('now'), 'odoo')`
    ).bind(identity.id, JSON.stringify({ partner_id: partnerId })).run();
  }
  return { identity, created: true, level0ViaOdoo: partnerId !== null };
}

export async function identityStatus(email: string, env: IdentityEnv) {
  const identity = await env.IDENTITY_DB.prepare(
    "SELECT * FROM identities WHERE email = ?"
  ).bind(email).first<any>();
  if (!identity) return null;
  const evidence = await env.IDENTITY_DB.prepare(
    `SELECT level, kind, decision, evidence_sha256, evidence_ref, submitted_at, reviewed_at, reviewer
     FROM level_evidence WHERE identity_id = ? ORDER BY level, submitted_at`
  ).bind(identity.id).all<any>();
  const approved = new Map<number, any>();
  for (const ev of evidence.results) {
    if (ev.decision === "approved") approved.set(ev.level, ev);
  }
  const checklist = LADDER.map((r) => ({
    level: r.level, key: r.key, title: r.title,
    state: approved.has(r.level) ? "approved"
      : evidence.results.some((e: any) => e.level === r.level && e.decision === "pending") ? "pending"
      : identity.level >= r.level ? "approved" : "missing",
  }));
  const highest = Math.max(identity.level, ...approved.keys(), -1);
  return {
    identity: { id: identity.id, partner_id: identity.partner_id, email: identity.email, name: identity.name, status: identity.status },
    highest_completed_level: highest,
    fully_verified: LADDER.every((r) => approved.has(r.level)),
    checklist,
  };
}

/**
 * Store evidence for a level. Files go to R2 (identity-evidence/...) with a
 * sha256 in D1; JSON evidence is stored inline. Auto-approves levels 0-5.
 */
export async function submitEvidence(
  email: string,
  level: number,
  file: File | null,
  payload: Record<string, unknown> | null,
  env: IdentityEnv
) {
  const rung = LADDER.find((r) => r.level === level);
  if (!rung) throw new Error(`Unknown level ${level}`);
  const st = await identityStatus(email, env);
  if (!st) throw new Error("Identity not enrolled — POST /api/identity/enroll first");
  if (st.identity.status !== "active") throw new Error("Identity is suspended");
  if (st.highest_completed_level < level - 1) {
    throw new Error(`Level ${level} requires level ${level - 1} completed first (currently at ${st.highest_completed_level})`);
  }
  const already = st.checklist.find((c) => c.level === level);
  if (already?.state === "approved") return { duplicate: true, level };

  let evidenceRef: string | null = null;
  let evidenceHash: string | null = null;
  let extra = payload ? JSON.stringify(payload) : null;

  if (rung.evidence === "file") {
    if (!file || file.size === 0) throw new Error(`Level ${level} (${rung.key}) requires an uploaded file`);
    if (rung.mimePrefixes && !rung.mimePrefixes.some((p) => file.type.startsWith(p))) {
      throw new Error(`Level ${level} expects ${rung.mimePrefixes.join(" or ")}; got ${file.type}`);
    }
    const buf = await file.arrayBuffer();
    evidenceHash = await sha256Hex(buf);
    if (env.MEDIA_LOCKER) {
      const safe = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
      evidenceRef = `identity-evidence/${safe}/level-${level}/${Date.now()}-${file.name || "evidence"}`;
      await env.MEDIA_LOCKER.put(evidenceRef, buf, { httpMetadata: { contentType: file.type } });
    }
  } else if (rung.evidence === "json") {
    if (!payload || Object.keys(payload).length === 0) {
      throw new Error(`Level ${level} (${rung.key}) requires a JSON payload (e.g. {"handles": {...}})`);
    }
  }

  const decision = rung.autoApprove ? "approved" : "pending";
  await env.IDENTITY_DB.prepare(
    `INSERT INTO level_evidence (identity_id, level, kind, evidence_ref, evidence_sha256, payload, decision, reviewed_at, reviewer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ${rung.autoApprove ? "datetime('now'), 'auto'" : "NULL, NULL"})`
  ).bind(st.identity.id, level, rung.key, evidenceRef, evidenceHash, extra, decision).run();

  if (decision === "approved") {
    await env.IDENTITY_DB.prepare(
      `UPDATE identities SET level = MAX(level, ?), updated_at = datetime('now') WHERE id = ?`
    ).bind(level, st.identity.id).run();
  }
  return { level, kind: rung.key, decision, evidenceRef, evidenceSha256: evidenceHash };
}

/** Admin review for levels 6-7. Requires the shared PASSCODE. */
export async function reviewEvidence(
  email: string,
  level: number,
  decision: "approved" | "rejected",
  note: string | undefined,
  passcode: string | undefined,
  reviewer: string | undefined,
  env: IdentityEnv
) {
  if (!env.PASSCODE || passcode !== env.PASSCODE) {
    throw new Error("Unauthorized: valid X-App-Password (PASSCODE) required");
  }
  const st = await identityStatus(email, env);
  if (!st) throw new Error("Identity not found");
  const res = await env.IDENTITY_DB.prepare(
    `UPDATE level_evidence SET decision = ?, reviewed_at = datetime('now'), reviewer = ?,
       payload = COALESCE(payload, '{}') || ?
     WHERE identity_id = ? AND level = ? AND decision = 'pending'`
  ).bind(decision, reviewer || "admin",
    note ? JSON.stringify({ reviewer_note: note }) : "",
    st.identity.id, level).run();
  if (!res.meta.changes) throw new Error(`No pending submission for level ${level}`);
  if (decision === "approved") {
    await env.IDENTITY_DB.prepare(
      `UPDATE identities SET level = MAX(level, ?), updated_at = datetime('now') WHERE id = ?`
    ).bind(level, st.identity.id).run();
  }
  return { email, level, decision, reviewer: reviewer || "admin" };
}

/**
 * Protection orchestration: register a generated output with the AssetID
 * protocol registry (cross-account, HTTPS) and link it to the identity in D1.
 * This is the "every output gets an Asset ID + verification URL" step.
 */
export async function registerProtectedOutput(
  email: string,
  title: string,
  file: File,
  env: IdentityEnv & { ASSETID_PROTOCOL_URL?: string }
) {
  const st = await identityStatus(email, env);
  if (!st) throw new Error("Identity not enrolled");
  if (file.size === 0) throw new Error("Output file is required");
  const buf = await file.arrayBuffer();
  const sha = await sha256Hex(buf);

  const base = (env.ASSETID_PROTOCOL_URL || "https://assetidprotocol.message-0ad.workers.dev").replace(/\/$/, "");
  const form = new FormData();
  form.append("file", new Blob([buf], { type: file.type || "application/octet-stream" }), file.name || "output.bin");
  form.append("title", title);
  form.append("creator", st.identity.name);
  form.append("email", email);
  form.append("licenseCode", "ARR");
  const res = await fetch(`${base}/api/assets`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const data: any = await res.json().catch(() => ({}));
  // 409 = same sha256 already registered upstream; treat as dedup success and
  // link the existing asset rather than failing the pipeline.
  if ((!res.ok && res.status !== 409) || !data.assetId) {
    throw new Error(`AssetID registration failed (${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  }
  await env.IDENTITY_DB.prepare(
    `INSERT INTO protected_outputs (identity_id, asset_id, watermark_id, sha256, title, mime_type, verification_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(st.identity.id, data.assetId, data.watermarkId ?? null, sha, title,
    file.type || "application/octet-stream", data.verificationUrl ?? null).run();

  return {
    assetId: data.assetId,
    watermarkId: data.watermarkId,
    sha256: sha,
    verificationUrl: data.verificationUrl,
    identity: st.identity.email,
    deduped: res.status === 409,
  };
}

/** List protected outputs for an identity (provenance chain). */
export async function listProtectedOutputs(email: string, env: IdentityEnv) {
  const st = await identityStatus(email, env);
  if (!st) throw new Error("Identity not found");
  const rows = await env.IDENTITY_DB.prepare(
    `SELECT asset_id, watermark_id, sha256, title, mime_type, verification_url, created_at
     FROM protected_outputs WHERE identity_id = ? ORDER BY created_at DESC`
  ).bind(st.identity.id).all<any>();
  return { identity: email, outputs: rows.results };
}
