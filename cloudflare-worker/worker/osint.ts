/**
 * Unified OSINT exposure scan (ported from the Argon blueprint osint_scanner.js).
 *
 * Every source is env-gated: if a key is absent the source is skipped gracefully
 * and the response records which sources were skipped.
 */

export interface OsintEnv {
  HaveIBeenPwned_API?: string;
  HudsonRock_API?: string;
  Epieos_API?: string;
  WhatsMyName_API?: string;
  HIBP_API_KEY?: string; // thread worker used this name; accepted as an alias
}

export interface OsintPayload {
  target?: string;
}

export async function runOsintScan(
  payload: OsintPayload,
  env: OsintEnv
): Promise<Record<string, unknown>> {
  const target = (payload.target || "").trim();
  if (!target) {
    throw new Error("Missing required field: target (email / username / phone).");
  }
  const results: Record<string, unknown> = {
    ok: true,
    target,
    timestamp: new Date().toISOString(),
    findings: {} as Record<string, unknown>,
    skipped: [] as string[],
  };
  const findings = results.findings as Record<string, unknown>;
  const skipped = results.skipped as string[];

  const promises: Promise<unknown>[] = [];

  const hibpKey = env.HaveIBeenPwned_API || env.HIBP_API_KEY;
  // 1. HaveIBeenPwned breach check (email targets only)
  if (hibpKey && target.includes("@")) {
    promises.push(
      fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(target)}`, {
        headers: { "hibp-api-key": hibpKey, "user-agent": "OIMO-LMA-OSINT-Agent" },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          findings.hibp_breaches = data;
        })
        .catch((err) => {
          findings.hibp_error = (err as Error).message;
        })
    );
  } else {
    skipped.push(target.includes("@") ? "hibp (no key)" : "hibp (not an email target)");
  }

  // 2. HudsonRock infostealer / malware compromise search
  if (env.HudsonRock_API) {
    promises.push(
      fetch(`https://api.hudsonrock.com/api/v1/osint/search?query=${encodeURIComponent(target)}`, {
        headers: { "api-key": env.HudsonRock_API },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          findings.hudson_rock = data;
        })
        .catch((err) => {
          findings.hudson_rock_error = (err as Error).message;
        })
    );
  } else {
    skipped.push("hudson_rock (no key)");
  }

  // 3. Epieos email / phone lookup
  if (env.Epieos_API && target.includes("@")) {
    promises.push(
      fetch(`https://api.epieos.com/v1/email/${encodeURIComponent(target)}`, {
        headers: { "X-API-Key": env.Epieos_API },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          findings.epieos = data;
        })
        .catch((err) => {
          findings.epieos_error = (err as Error).message;
        })
    );
  } else {
    skipped.push(target.includes("@") ? "epieos (no key)" : "epieos (not an email target)");
  }

  // 4. WhatsMyName username enumeration (non-email targets only)
  if (env.WhatsMyName_API && !target.includes("@")) {
    promises.push(
      fetch(`https://api.whatsmyname.app/v1/search?username=${encodeURIComponent(target)}`, {
        headers: { Authorization: `Bearer ${env.WhatsMyName_API}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          findings.whatsmyname = data;
        })
        .catch((err) => {
          findings.whatsmyname_error = (err as Error).message;
        })
    );
  } else {
    skipped.push(target.includes("@") ? "whatsmyname (email target)" : "whatsmyname (no key)");
  }

  await Promise.allSettled(promises);
  return results;
}
