import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, advance, image, Canvas } from "./worker/canvas.mjs";
function storage() {
  const values = new Map();
  let tail = Promise.resolve();
  const api = {
    async get() {
      return values.get(arguments[0]);
    },
    async put(k, v) {
      values.set(k, structuredClone(v));
    },
    transaction(f) {
      const run = tail.then(() => f(api));
      tail = run.catch(() => {});
      return run;
    },
  };
  return api;
}
const points = [
  [10, 10],
  [20, 20],
];
test("sharedstate preservesexactpoints/47 and cooldown", () => {
  const a = advance(
    initialState(),
    points,
    "https://example.com/",
    1000,
    "test",
  );
  assert.equal(a.strokes.length, 47);
  assert.deepEqual(a.strokes.at(-1).points, points);
  assert.equal(a.nextAllowed, 301000);
  assert.throws(
    () => advance(a, points, "", 1001, "fail"),
    (e) => e.status === 429,
  );
  assert.equal(advance(a, points, "", 301000, "ok").version, 2);
});
test("concurrentwrite transaction acceptsone and persistsacrossobjects", async () => {
  const s = storage(),
    a = new Canvas({ storage: s }),
    b = new Canvas({ storage: s });
  const req = () =>
    new Request("https://example.com/api/strokes", {
      method: "POST",
      body: JSON.stringify({ points, url: "", requestId: crypto.randomUUID() }),
    });
  const results = await Promise.all([a.fetch(req()), b.fetch(req())]);
  assert.deepEqual(results.map((x) => x.status).sort(), [201, 429]);
  const fresh = new Canvas({ storage: s });
  const state = await (
    await fresh.fetch(new Request("https://example.com/api/canvas"))
  ).json();
  assert.equal(state.version, 1);
  assert.equal(state.strokes.length, 47);
  assert(state.nextAllowed > Date.now());
});
test("server rejectsinvalidgeometry/URLs and imagehasno visitor links", async () => {
  const a = new Canvas({ storage: storage() });
  for (const body of [
    {
      points: [
        [0, 0],
        [9999, 2],
      ],
      url: "",
    },
    { points, url: "javascript:alert(1)" },
    { points, url: "https://127.0.0.1/" },
    { points, url: "", more: 1 },
  ])
    assert.equal(
      (
        await a.fetch(
          new Request("https://example.com/api/strokes", {
            method: "POST",
            body: JSON.stringify({ ...body, requestId: crypto.randomUUID() }),
          }),
        )
      ).status,
      400,
    );
  const svg = image(initialState());
  assert.equal((svg.match(/<polyline/g) || []).length, 47);
  assert(!svg.includes("href="));
  assert(svg.includes("#000000"));
});

test("sameIDreplay neveraddsduplicate and rejectspayloadchange", async () => {
  const a = new Canvas({ storage: storage() }),
    id = crypto.randomUUID();
  const req = (p = points) =>
    new Request("https://example.com/api/strokes", {
      method: "POST",
      body: JSON.stringify({ points: p, url: "", requestId: id }),
    });
  assert.equal((await a.fetch(req())).status, 201);
  assert.equal((await a.fetch(req())).status, 200);
  assert.equal(
    (
      await a.fetch(
        req([
          [2, 2],
          [30, 30],
        ]),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await (
        await a.fetch(new Request("https://example.com/api/canvas"))
      ).json()
    ).version,
    1,
  );
});

test("worker gate rejects crossorigin/bodytype/read-only and exposeswriteflag", async () => {
  const { default: worker } = await import("./worker/index.mjs");
  const env = {
    PUBLIC_WRITES: "disabled",
    CANVAS: {
      idFromName() {
        return "one";
      },
      get() {
        return new Canvas({ storage: storage() });
      },
    },
    ASSETS: {
      fetch() {
        return new Response("asset");
      },
    },
  };
  const base = "https://example.com";
  assert.equal(
    (
      await worker.fetch(
        new Request(base + "/api/strokes", {
          method: "POST",
          headers: {
            Origin: "https://wrong.com",
            "Content-Type": "application/json",
          },
          body: "{}",
        }),
        env,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request(base + "/api/strokes", {
          method: "POST",
          headers: { Origin: base, "Content-Type": "text/plain" },
          body: "{}",
        }),
        env,
      )
    ).status,
    415,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request(base + "/api/strokes", {
          method: "POST",
          headers: { Origin: base, "Content-Type": "application/json" },
          body: "{}",
        }),
        env,
      )
    ).status,
    503,
  );
  const state = await (
    await worker.fetch(new Request(base + "/api/canvas"), env)
  ).json();
  assert.equal(state.writesEnabled, false);
  env.PUBLIC_WRITES = "enabled";
  env.TURNSTILE_SECRET = "test";
  env.TURNSTILE_SITE_KEY = "test";
  env.VISITOR_SECRET = "test";
  assert.equal(
    (
      await worker.fetch(
        new Request(base + "/api/strokes", {
          method: "POST",
          headers: { Origin: base, "Content-Type": "application/json" },
          body: " ".repeat(70001),
        }),
        env,
      )
    ).status,
    413,
  );
});

test("signedbrowsercookie resistsforgery and missingadmin/bot failsclosed", async () => {
  const { visitor, admin, bot } = await import("./worker/guard.mjs");
  const r = new Request("https://example.com/");
  const a = await visitor(r, "test-secret");
  assert(a.cookie.includes("HttpOnly"));
  assert(a.cookie.includes("Secure"));
  const b = await visitor(
    new Request(r, { headers: { Cookie: a.cookie.split(";")[0] } }),
    "test-secret",
  );
  assert.equal(b.id, a.id);
  assert.equal(b.cookie, null);
  const c = await visitor(
    new Request(r, { headers: { Cookie: "47visitor=" + a.id + ".bad" } }),
    "test-secret",
  );
  assert.notEqual(c.id, a.id);
  assert.equal(await admin(r, {}), false);
  assert.equal(await bot("", r, {}), false);
});
test("bot hostname/action checking and browserhourlimit/replay", async () => {
  const old = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ success: true, hostname: "example.com", action: "stroke" });
  try {
    const s = storage();
    const a = new Canvas(
      { storage: s },
      { PUBLIC_WRITES: "enabled", TURNSTILE_SECRET: "local-test" },
    );
    const req = (id, visitor = "browser-a") =>
      new Request("https://example.com/api/strokes", {
        method: "POST",
        headers: { "X-Visitor-ID": visitor },
        body: JSON.stringify({
          points,
          url: "",
          requestId: id,
          token: "dummy-local-token",
        }),
      });
    const id = crypto.randomUUID();
    assert.equal((await a.fetch(req(id))).status, 201);
    const state = await s.get("canvas");
    await s.put("canvas", { ...state, nextAllowed: 0 });
    assert.equal((await a.fetch(req(crypto.randomUUID()))).status, 429);
    assert.equal((await a.fetch(req(id))).status, 200);
    assert.equal(
      (await a.fetch(req(crypto.randomUUID(), "browser-b"))).status,
      201,
    );
    globalThis.fetch = async () =>
      Response.json({ success: true, hostname: "wrong.com", action: "stroke" });
    assert.equal(
      (await a.fetch(req(crypto.randomUUID(), "browser-c"))).status,
      403,
    );
  } finally {
    globalThis.fetch = old;
  }
});

test("admin signedtokens requireexpiration and exactaud/owner", async () => {
  const { generateKeyPair, exportJWK, SignJWT } = await import("jose");
  const { admin } = await import("./worker/guard.mjs");
  const keys = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(keys.publicKey);
  jwk.kid = "local";
  const old = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ keys: [jwk] });
  const env = {
    ACCESS_TEAM_DOMAIN: "local-test.cloudflareaccess.com",
    ACCESS_AUD: "aud-local",
    ADMIN_EMAIL: "owner@example.com",
  };
  try {
    const base = () =>
      new SignJWT({ email: "owner@example.com" })
        .setProtectedHeader({ alg: "RS256", kid: "local" })
        .setIssuer("https://" + env.ACCESS_TEAM_DOMAIN)
        .setAudience("aud-local")
        .setIssuedAt();
    const missing = await base().sign(keys.privateKey);
    const valid = await base().setExpirationTime("5m").sign(keys.privateKey);
    const req = (t) =>
      new Request("https://example.com/admin", {
        headers: { "Cf-Access-Jwt-Assertion": t },
      });
    assert.equal(await admin(req(missing), env), false);
    assert.equal(await admin(req(valid), env), true);
    assert.equal(
      await admin(req(valid), { ...env, ADMIN_EMAIL: "other@example.com" }),
      false,
    );
    assert.equal(
      await admin(req(valid), { ...env, ACCESS_AUD: "wrong" }),
      false,
    );
  } finally {
    globalThis.fetch = old;
  }
});
