/**
 * Age verification gateway (ported from the Argon blueprint age_verification.js).
 *
 * Yoti / Ondato are env-gated. When neither provider is configured (or the
 * requested provider is unavailable), a clearly-labeled NON-PRODUCTION mock
 * token is returned for local testing only.
 */

export interface AgeEnv {
  Yoti_API?: string;
  Ondato_Age_Verification_API?: string;
}

export interface AgePayload {
  sessionToken?: string;
  provider?: string; // "yoti" | "ondato"
}

export async function verifyAgeToken(
  payload: AgePayload,
  env: AgeEnv
): Promise<Record<string, unknown>> {
  const { sessionToken, provider } = payload;

  if (provider === "yoti" && env.Yoti_API && sessionToken) {
    const res = await fetch(`https://api.yoti.com/api/v1/age-verification/${sessionToken}`, {
      headers: { "X-Yoti-Auth-Key": env.Yoti_API },
    });
    if (res.ok) {
      const data: any = await res.json();
      return {
        verified: Boolean(data.age_verified),
        token: data.signed_jwt,
        platform: "Texas_CUBI_Compliant",
        production: true,
        provider: "yoti",
      };
    }
    return {
      verified: false,
      token: null,
      platform: "Texas_CUBI_Compliant",
      production: true,
      provider: "yoti",
      error: `Yoti verification lookup failed with status ${res.status}`,
    };
  }

  if (provider === "ondato" && env.Ondato_Age_Verification_API && sessionToken) {
    const res = await fetch(`https://api.ondato.com/v1/identification/${sessionToken}`, {
      headers: { "X-Api-Key": env.Ondato_Age_Verification_API },
    });
    if (res.ok) {
      const data: any = await res.json();
      return {
        verified: data.status === "Approved",
        token: data.id,
        platform: "Texas_HB1181_Compliant",
        production: true,
        provider: "ondato",
      };
    }
    return {
      verified: false,
      token: null,
      platform: "Texas_HB1181_Compliant",
      production: true,
      provider: "ondato",
      error: `Ondato verification lookup failed with status ${res.status}`,
    };
  }

  // Fallback mock token for local testing — explicitly NOT production grade.
  return {
    verified: true,
    token: "JWT_MOCK_TEXAS_CUBI_APPROVED_001",
    platform: "Argon_Internal_Verification",
    production: false,
    provider: provider || "mock",
    warning:
      "NON-PRODUCTION mock token: configure Yoti_API or Ondato_Age_Verification_API secrets for real Texas HB1181 / CUBI age verification.",
  };
}
