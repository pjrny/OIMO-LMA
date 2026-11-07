/**
 * AssetID Protocol proxy — forwards protection/identification calls from this
 * worker to the deployed AssetID registry worker, which lives on a different
 * Cloudflare account (0adf...) and therefore cannot be reached via a service
 * binding; plain HTTPS to its public workers.dev URL is the integration path.
 *
 * Upstream (pjrny/AssetIDProtocol, MIT):
 *   POST /api/assets            multipart register -> {assetId, watermarkId, sha256, verificationUrl}
 *   POST /api/identify          exact match by watermarkId or sha256
 *   POST /api/visual-identify   fuzzy visual match (recognizer pHash/dHash/HSV)
 *   GET  /api/assets/:id        registry record
 *   GET  /verify/:id            human-facing passport page (HTML)
 *   GET  /api/health            liveness
 *
 * The recognizer worker itself is service-bound to the registry upstream and
 * needs no direct calls from here.
 */

export interface AssetIdEnv {
  ASSETID_PROTOCOL_URL?: string;
}

const DEFAULT_PROTOCOL_URL = "https://assetidprotocol.message-0ad.workers.dev";

export function assetIdBase(env: AssetIdEnv): string {
  return (env.ASSETID_PROTOCOL_URL || DEFAULT_PROTOCOL_URL).replace(/\/$/, "");
}

/**
 * Forward a request to the AssetID registry. Passes the original body through
 * untouched (FormData multipart for uploads, JSON otherwise) and returns the
 * upstream response with its status, content type and body.
 */
export async function assetIdProxy(
  upstreamPath: string,
  request: Request,
  env: AssetIdEnv,
  methodOverride?: string
): Promise<Response> {
  const upstream = `${assetIdBase(env)}${upstreamPath}`;
  const method = methodOverride || request.method;
  const headers = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const hasBody = method !== "GET" && method !== "HEAD";
  const res = await fetch(upstream, {
    method,
    headers,
    ...(hasBody ? { body: request.body } : {}),
    // @ts-expect-error duplex is required when forwarding a streamed body
    duplex: "half",
    signal: AbortSignal.timeout(60_000),
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
