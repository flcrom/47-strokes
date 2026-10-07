import { exportBatch, pruneBatch, archiveRate } from "./archive.mjs";
import { validateMotion } from "../src/motion.mjs";
import { initializeHistory, archiveAccepted } from "./history.mjs";
import {
  seed,
  validate,
  COOLDOWN,
  ageShade,
  WIDTH,
  HEIGHT,
} from "../src/core.mjs";
import { introStrokes } from "./intro.mjs";
export function initialState() {
  return { version: 0, strokes: structuredClone(introStrokes), nextAllowed: 0 };
}
export function advance(state, points, url, now, id) {
  if (now < state.nextAllowed) {
    const e = new Error("The canvas is resting. Your draft is kept.");
    e.status = 429;
    e.nextAllowed = state.nextAllowed;
    throw e;
  }
  const stroke = validate(points, url);
  return {
    version: state.version + 1,
    strokes: [...state.strokes.slice(-46), { ...stroke, id }],
    nextAllowed: now + COOLDOWN,
  };
}
export function snapshot(state, now) {
  const { visitorNext, ...publicState } = state;
  return {
    ...publicState,
    strokes: state.strokes.map(({ reports, reporters, ...stroke }) => stroke),
    serverNow: now,
    width: WIDTH,
    height: HEIGHT,
  };
}
export function image(state) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="47 strokes shared canvas"><rect width="100%" height="100%" fill="white"/>${state.strokes.map((s, i) => `<polyline points="${s.points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${ageShade(i, state.strokes.length)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</svg>`;
}
import { bot } from "./guard.mjs";
export class Canvas {
  constructor(ctx, env = {}) {
    this.ctx = ctx;
    this.env = env;
  }
  async read() {
    const state = (await this.ctx.storage.get("canvas")) || initialState();
    await initializeHistory(this.ctx.storage, initialState());
    return state;
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if(path==="/internal/archive-rate") { if(request.method!=="POST"||request.headers.get("X-Archive-Verified")!=="yes")return new Response("Forbidden",{status:403});return new Response(null,{status:await archiveRate(this.ctx.storage)?200:429}); }
    if (path.startsWith("/internal/archive/")) {
      if(request.method!=="POST" || request.headers.get("X-Archive-Verified")!=="yes")return new Response("Forbidden",{status:403});
      try { const result=path==="/internal/archive/export" ? await exportBatch(this.ctx.storage) : path==="/internal/archive/prune" ? await pruneBatch(this.ctx.storage,await request.json()) : null;
        if(!result)return new Response("Not found",{status:404});
        return Response.json(result,{headers:{"Cache-Control":"no-store"}});
      } catch { return Response.json({error:"Archive batch could not be processed. Nothing cleared."},{status:400}); }
    }
    // Capture baseline before any route can accept and evict its oldest stroke.
    await initializeHistory(this.ctx.storage, initialState());
    let now = Date.now();
    if (
      path === "/internal/admin" &&
      request.headers.get("X-Owner-Verified") === "yes"
    ) {
      if (request.method === "GET") {
        const state = await this.read();
        return Response.json({
          version: state.version,
          strokes: state.strokes
            .filter((s) => s.url)
            .map((s) => ({ id: s.id, url: s.url, reports: s.reports || 0 })),
        });
      }
      if (request.method === "POST") {
        try {
          const { id } = await request.json();
          const state = await this.ctx.storage.transaction(async (tx) => {
            const previous = (await tx.get("canvas")) || initialState();
            const found = previous.strokes.find((s) => s.id === id);
            if (!found) throw Error("This stroke is no longer on the canvas.");
            const next = {
              ...previous,
              version: previous.version + 1,
              strokes: previous.strokes.map((s) =>
                s.id === id ? { ...s, url: "", reports: 0, reporters: [] } : s,
              ),
            };
            await tx.put("canvas", next);
            return next;
          });
          return Response.json(snapshot(state, Date.now()));
        } catch (e) {
          return Response.json({ error: e.message }, { status: 400 });
        }
      }
    }
    if (path === "/internal/report" && request.method === "POST") {
      try {
        const { id, token } = await request.json();
        if (!(await bot(token, request, this.env, "report")))
          return Response.json(
            { error: "Complete the bot check again." },
            { status: 403 },
          );
        await this.ctx.storage.transaction(async (tx) => {
          const previous = (await tx.get("canvas")) || initialState();
          const found = previous.strokes.find((s) => s.id === id && s.url);
          if (!found)
            throw Error("That linked stroke is no longer on the canvas.");
          const reporter = request.headers.get("X-Visitor-ID");
          if (!reporter) throw Error("Reload the page before reporting.");
          if (
            (found.reporters || []).includes(reporter) ||
            (found.reporters || []).length >= 100
          )
            return;
          const next = {
            ...previous,
            strokes: previous.strokes.map((s) =>
              s.id === id
                ? {
                    ...s,
                    reports: Math.min(100, (s.reports || 0) + 1),
                    reporters: [...(s.reporters || []), reporter],
                  }
                : s,
            ),
          };
          await tx.put("canvas", next);
        });
        return Response.json({ reported: true });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 400 });
      }
    }
    if (request.method === "GET") {
      const state = await this.read();
      if (path === "/canvas.svg")
        return new Response(image(state), {
          headers: {
            "Content-Type": "image/svg+xml",
            "Cache-Control": "public,max-age=15",
            "X-Content-Type-Options": "nosniff",
          },
        });
      return Response.json(snapshot(state, now), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    try {
      const body = await request.json();
      if (
        !body ||
        Object.keys(body).some(
          (k) => !["points", "url", "requestId", "token", "motion"].includes(k),
        ) ||
        typeof body.url !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          body.requestId || "",
        )
      )
        throw Error("Send one path and an optional HTTPS link.");
      validate(body.points, body.url);
      const motion = validateMotion(body.motion);
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(JSON.stringify(motion ? [body.points, body.url, motion] : [body.points, body.url])),
          ),
        ),
      )
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
      const protectedMode = this.env.PUBLIC_WRITES === "enabled";
      const visitorID = request.headers.get("X-Visitor-ID");
      const known = await this.ctx.storage.get("receipt:" + body.requestId);
      if (
        protectedMode &&
        !known &&
        (!visitorID || !(await bot(body.token, request, this.env)))
      )
        return Response.json(
          { error: "Complete the bot check again." },
          { status: 403 },
        );
      let replay = false;
      const state = await this.ctx.storage.transaction(async (tx) => {
        const previous = (await tx.get("canvas")) || initialState();
        now = Date.now();
        const priorReceipt = await tx.get("receipt:" + body.requestId);
        if (priorReceipt) {
          if (priorReceipt !== digest) {
            const e = new Error(
              "This submission ID was already used for a different path.",
            );
            e.status = 409;
            throw e;
          }
          replay = true;
          return previous;
        }
        if (protectedMode) {
          const visitorNext = previous.visitorNext?.[visitorID] || 0;
          if (now < visitorNext) {
            const e = new Error(
              "This browser can add one stroke per hour. Your draft is kept.",
            );
            e.status = 429;
            e.nextAllowed = visitorNext;
            throw e;
          }
        }
        const next = advance(
          previous,
          body.points,
          body.url,
          now,
          body.requestId,
        );
        if (protectedMode)
          next.visitorNext = {
            ...Object.fromEntries(
              Object.entries(previous.visitorNext || {}).filter(
                ([, until]) => until > now,
              ),
            ),
            [visitorID]: now + 3600000,
          };
        await archiveAccepted(tx, next.strokes.at(-1), now, motion);
        await tx.put("canvas", next);
        await tx.put("receipt:" + body.requestId, digest);
        return next;
      });
      return Response.json(
        {
          ...snapshot(state, now),
          acceptedId: body.requestId,
          replayed: replay,
        },
        {
          status: replay ? 200 : 201,
          headers: { "Cache-Control": "no-store" },
        },
      );
    } catch (e) {
      return Response.json(
        { error: e.message, nextAllowed: e.nextAllowed, serverNow: Date.now() },
        { status: e.status || 400, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
}
