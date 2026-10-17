type SiteverifyResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

export async function verifyTurnstileToken(token: unknown, expectedAction: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  const hostnames = new Set(
    (process.env.TURNSTILE_HOSTNAMES ?? "").split(",").map((hostname) => hostname.trim()).filter(Boolean),
  );
  if (typeof token !== "string" || token.length === 0 || token.length > 2048 || !secret || hostnames.size === 0) {
    return false;
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ secret, response: token }),
    });
    if (!response.ok) return false;
    const result = await response.json() as SiteverifyResult;
    return result.success === true
      && result.action === expectedAction
      && typeof result.hostname === "string"
      && hostnames.has(result.hostname);
  } catch {
    return false;
  }
}