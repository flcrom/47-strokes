function bytes(s) {
  return Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
}
function b64(a) {
  return btoa(String.fromCharCode(...a))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
async function mac(secret, data) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)),
    ),
  );
}
export async function visitor(request, secret) {
  if (!secret) throw Error("Visitor protection is not configured.");
  const raw =
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("47visitor="))
      ?.slice(10) || "";
  const [id, sig] = raw.split(".");
  if (/^[0-9a-f-]{36}$/.test(id || "") && sig === (await mac(secret, id)))
    return { id, cookie: null };
  const fresh = crypto.randomUUID();
  return {
    id: fresh,
    cookie: `47visitor=${fresh}.${await mac(secret, fresh)}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`,
  };
}
export async function bot(token, request, env, action = "stroke") {
  if (
    !env.TURNSTILE_SECRET ||
    typeof token !== "string" ||
    token.length > 2048 ||
    !token
  )
    return false;
  try {
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        signal: AbortSignal.timeout(7000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET,
          response: token,
          remoteip: request.headers.get("CF-Connecting-IP") || undefined,
        }),
      },
    );
    const v = await r.json();
    return (
      v.success === true &&
      v.hostname === new URL(request.url).hostname &&
      v.action === action
    );
  } catch {
    return false;
  }
}
const sets = new Map();
export async function admin(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAIL)
    return false;
  try {
    const { jwtVerify, createRemoteJWKSet } = await import("jose");
    const issuer = "https://" + env.ACCESS_TEAM_DOMAIN;
    let keys = sets.get(issuer);
    if (!keys) {
      keys = createRemoteJWKSet(new URL(issuer + "/cdn-cgi/access/certs"));
      sets.set(issuer, keys);
    }
    const { payload } = await jwtVerify(
      request.headers.get("Cf-Access-Jwt-Assertion") || "",
      keys,
      {
        issuer,
        audience: env.ACCESS_AUD,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "iat", "email"],
      },
    );
    return payload.email?.toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
  } catch {
    return false;
  }
}
