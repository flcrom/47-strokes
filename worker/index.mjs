import { visitor, admin } from "./guard.mjs";
export { Canvas } from "./canvas.mjs";
const MAX_BODY = 70000;
async function boundedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("Missing stroke.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      await reader.cancel();
      throw Error("Submission is too large.");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let cursor = 0;
  for (const c of chunks) {
    data.set(c, cursor);
    cursor += c.byteLength;
  }
  return data;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      if (!(await admin(request, env)))
        return new Response("Private owner sign-in required", {
          status: 403,
          headers,
        });
      if (url.pathname.startsWith("/admin/api/")) {
        if (
          request.method === "POST" &&
          request.headers.get("Origin") !== url.origin
        )
          return new Response("Wrong origin", { status: 403 });
        if (!["GET", "POST"].includes(request.method))
          return new Response("Method not allowed", { status: 405 });
        let data;
        if (request.method === "POST") {
          try {
            data = await boundedBody(request);
          } catch {
            return new Response("Too large", { status: 413 });
          }
        }
        const forwarded = new Request(url.origin + "/internal/admin", {
          method: request.method,
          headers: {
            "X-Owner-Verified": "yes",
            "Content-Type": "application/json",
          },
          body: data,
        });
        return env.CANVAS.get(env.CANVAS.idFromName("shared-canvas-v1")).fetch(
          forwarded,
        );
      }
      return env.ASSETS.fetch(request);
    }
    if (
      url.pathname === "/api/canvas" ||
      url.pathname === "/api/strokes" ||
      url.pathname === "/api/report" ||
      url.pathname === "/canvas.svg"
    ) {
      const method = request.method;
      const write = ["/api/strokes", "/api/report"].includes(url.pathname);
      let identity;
      if ((write && method !== "POST") || (!write && method !== "GET"))
        return new Response("Method not allowed", { status: 405, headers });
      if (write) {
        if (request.headers.get("Origin") !== url.origin)
          return new Response("Wrong origin", { status: 403, headers });
        if (
          !request.headers.get("Content-Type")?.startsWith("application/json")
        )
          return new Response("Use JSON", { status: 415, headers });
        // Public writes remain closed until the production abuse-protection route is reviewed.
        if (
          env.PUBLIC_WRITES !== "enabled" ||
          !env.TURNSTILE_SECRET ||
          !env.VISITOR_SECRET ||
          !env.TURNSTILE_SITE_KEY
        )
          return Response.json(
            { error: "The canvas is read-only while launch checks finish." },
            { status: 503, headers },
          );
        let bytes;
        try {
          bytes = await boundedBody(request);
        } catch (e) {
          return Response.json({ error: e.message }, { status: 413, headers });
        }
        identity = await visitor(request, env.VISITOR_SECRET);
        const forwardedHeaders = new Headers(request.headers);
        forwardedHeaders.delete("X-Owner-Verified");
        forwardedHeaders.set("X-Visitor-ID", identity.id);
        request = new Request(
          url.pathname === "/api/report"
            ? url.origin + "/internal/report"
            : request.url,
          {
            method: "POST",
            headers: forwardedHeaders,
            body: bytes,
          },
        );
      }
      if (!write && url.pathname === "/api/canvas" && env.VISITOR_SECRET)
        identity = await visitor(request, env.VISITOR_SECRET);
      const id = env.CANVAS.idFromName("shared-canvas-v1");
      const response = await env.CANVAS.get(id).fetch(request);
      if (url.pathname === "/api/canvas" && response.ok) {
        const body = await response.json();
        return Response.json(
          {
            ...body,
            writesEnabled:
              env.PUBLIC_WRITES === "enabled" &&
              !!env.TURNSTILE_SECRET &&
              !!env.VISITOR_SECRET &&
              !!env.TURNSTILE_SITE_KEY,
            turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
          },
          {
            headers: {
              "Cache-Control": "no-store",
              ...headers,
              ...(identity?.cookie ? { "Set-Cookie": identity.cookie } : {}),
            },
          },
        );
      }
      if (identity?.cookie) {
        const h = new Headers(response.headers);
        h.set("Set-Cookie", identity.cookie);
        return new Response(response.body, {
          status: response.status,
          headers: h,
        });
      }
      return response;
    }
    return env.ASSETS.fetch(request);
  },
};
