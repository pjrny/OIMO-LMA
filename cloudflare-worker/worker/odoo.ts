/**
 * Shared Odoo JSON-RPC helpers for the OIMO / LMA worker.
 *
 * Two Odoo instances are in play:
 *  - "erp"    -> xxxooo.odoo.com (identity entities, accounting, discuss, MCP)
 *  - "locker" -> xoxo.odoo.com  (media locker attachments + LMS courses)
 */

export interface OdooInstance {
  baseUrl: string;
  db: string;
  uid: number;
  apiKey: string;
}

/** Minimal env surface needed by this module (structurally matched by the full Env). */
export interface OdooEnv {
  XXXOOO_ODOO_URL: string;
  XXXOOO_ODOO_DB: string;
  XXXOOO_UID: string;
  XXXOOO_API_KEY: string;
  XOXO_ODOO_URL: string;
  XOXO_ODOO_DB: string;
  XOXO_UID: string;
  XOXO_API_KEY: string;
}

/** Resolve the ERP (xxxooo) or LOCKER (xoxo) Odoo instance from env bindings. */
export function getOdooInstance(kind: "erp" | "locker", env: OdooEnv): OdooInstance {
  if (kind === "erp") {
    return {
      baseUrl: (env.XXXOOO_ODOO_URL || "https://xxxooo.odoo.com").replace(/\/$/, ""),
      db: env.XXXOOO_ODOO_DB || "xxxooo",
      uid: parseInt(env.XXXOOO_UID || "2", 10),
      apiKey: env.XXXOOO_API_KEY,
    };
  }
  return {
    baseUrl: (env.XOXO_ODOO_URL || "https://xoxo.odoo.com").replace(/\/$/, ""),
    db: env.XOXO_ODOO_DB || "xoxo",
    uid: parseInt(env.XOXO_UID || "2", 10),
    apiKey: env.XOXO_API_KEY,
  };
}

/**
 * Generic Odoo JSON-RPC execute_kw helper, works against both instances.
 */
export async function odooExecuteKw(
  baseUrl: string,
  db: string,
  uid: number,
  apiKey: string,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {}
): Promise<any> {
  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [db, uid, apiKey, model, method, args, kwargs],
    },
    id: Date.now(),
  };
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/jsonrpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const data: any = await res.json();
  if (data.error) {
    throw new Error(`Odoo RPC Error (${model}.${method}): ${JSON.stringify(data.error)}`);
  }
  return data.result;
}
