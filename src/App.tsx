import { createMotion, recordMotion, finishMotion } from "./motion.mjs";
import React, { useEffect, useRef, useState } from "react";
import { FileCard, FileButton } from "./ui";
import {
  seed,
  validate,
  accept,
  ageShade,
  nearestStroke,
  remaining,
  pathLength,
  extendPath,
  MAX_LENGTH,
  WIDTH,
  HEIGHT,
  type Stroke,
} from "./core.mjs";
import "./style.css";
import {
  loadShared,
  addShared,
  SubmissionError,
  type SharedState,
} from "./shared";
import { BotCheck } from "./BotCheck";
import { Admin } from "./Admin";
import { StrokeList } from "./StrokeList";
import { ProfilePicker } from "./ProfilePicker";
import { profileURL } from "./profiles.mjs";
import { formatStrokeTime } from "./StrokeList";
const initial = seed();
const sharedMode = import.meta.env.VITE_SHARED_CANVAS === "true";
export function App() {
  if (window.location.pathname.startsWith("/admin")) return <Admin />;
  return <CanvasApp />;
}
function CanvasApp() {
  const [a, setA] = useState<Stroke[]>(initial.slice(0, 24));
  const [b, setB] = useState<Stroke[]>(initial.slice(24));
  const [next, setNext] = useState<number>(0);
  const [draft, setDraft] = useState<number[][]>([]);
  const [url, setUrl] = useState<string>(""),
    [kind, setKind] = useState("manual");
  const [now, setNow] = useState(Date.now()),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Stroke | null>(null),
    [touchReveal, setTouchReveal] = useState(false),
    [hoverAt, setHoverAt] = useState({ x: 0, y: 0 }),
    [used, setUsed] = useState(0);
  const motion = useRef<any>(null);
  const [draftMotion, setDraftMotion] = useState<any>(undefined);
  const pointer = useRef<number | null>(null);
  const gesture = useRef<{ x: number; y: number; moved: boolean; canDraw: boolean; hit: Stroke | null; mouse: boolean } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    active = useRef(false),
    points = useRef<number[][]>([]);
  const [loaded, setLoaded] = useState(!sharedMode),
    [sending, setSending] = useState(false);
  const pending = useRef<{
    requestId: string;
    points: number[][];
    url: string;
    motion?: any;
  } | null>(null);
  const offset = useRef(0),
    version = useRef(-1);
  const [siteKey, setSiteKey] = useState(
      sessionStorage.getItem("47-turnstile-key") || "",
    ),
    [botToken, setBotToken] = useState(""),
    [botNonce, setBotNonce] = useState(0);
  const [writesEnabled, setWritesEnabled] = useState(!sharedMode);
  const ready = loaded && !sending && writesEnabled,
    strokes = [...a, ...b],
    waiting = next > now;
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => clearInterval(id);
  }, []);
  function applyShared(state: SharedState) {
    if (state.version < version.current) return;
    version.current = state.version;
    offset.current = state.serverNow - Date.now();
    setA(state.strokes.slice(0, 24));
    setB(state.strokes.slice(24));
    setNext(state.nextAllowed);
    setNow(state.serverNow);
    setLoaded(true);
    if (state.turnstileSiteKey !== undefined) {
      setSiteKey(state.turnstileSiteKey);
      sessionStorage.setItem("47-turnstile-key", state.turnstileSiteKey);
    }
    if (typeof state.writesEnabled === "boolean")
      setWritesEnabled(state.writesEnabled);
    if (
      pending.current &&
      state.strokes.some((s) => s.id === pending.current?.requestId)
    ) {
      pending.current = null;
      sessionStorage.removeItem("47-strokes-pending");
      setDraft([]);
      setUrl("");
      setKind("manual");
      setError("");
    }
  }
  useEffect(() => {
    if (!sharedMode) return;
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("47-strokes-pending") || "null",
      );
      if (saved?.requestId && Array.isArray(saved.points)) {
        validate(saved.points, saved.url);
        pending.current = saved;
        setDraft(saved.points);
        setDraftMotion(saved.motion);
        setUrl(saved.url);
        setKind("manual");
      }
    } catch {
      sessionStorage.removeItem("47-strokes-pending");
    }
    let alive = true;
    const sync = async () => {
      try {
        const state = await loadShared();
        if (alive) applyShared(state);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void sync();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void sync();
    }, 15000);
    const visible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  function draw() {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [i, s] of [
      ...strokes,
      { id: "draft", points: active.current ? points.current : draft, url: "" },
    ].entries()) {
      if (!s.points.length) continue;
      ctx.strokeStyle = s.id === "draft" ? "#000000" : ageShade(i, strokes.length);
      ctx.lineWidth = 2;
      ctx.beginPath();
      s.points.forEach((p, i) =>
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
      );
      ctx.stroke();
    }
  }
  useEffect(draw, [a, b, draft]);
  useEffect(() => setUsed(pathLength(draft)), [draft]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return [
      Math.round(
        Math.max(0, Math.min(WIDTH, ((e.clientX - r.left) / r.width) * WIDTH)),
      ),
      Math.round(
        Math.max(
          0,
          Math.min(HEIGHT, ((e.clientY - r.top) / r.height) * HEIGHT),
        ),
      ),
    ];
  }
  function hit(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return nearestStroke(strokes, point(e), 7 * WIDTH / r.width);
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!loaded || active.current || !e.isPrimary || (e.button !== 0 && e.pointerType === "mouse")) return;
    const canDraw = ready && !waiting && !pending.current && !draft.length;
    const mouse = e.pointerType === "mouse";

    gesture.current = { x: e.clientX, y: e.clientY, moved: false, canDraw, hit: hit(e), mouse };
    setSelected(null); setTouchReveal(false);
    active.current = true;
    pointer.current = e.pointerId;
    points.current = canDraw ? [point(e)] : [];
    motion.current = canDraw ? createMotion(...point(e), e.timeStamp) : null;
    if (canDraw) { setError(""); setUsed(0); }
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active.current) {
      if (e.pointerType === "mouse" && loaded) {
        const r = e.currentTarget.getBoundingClientRect();
        setTouchReveal(false); setSelected(hit(e));
        setHoverAt({ x: 100 * (e.clientX - r.left) / r.width, y: 100 * (e.clientY - r.top) / r.height });
      }
      return;
    }
    if (e.pointerId !== pointer.current || !gesture.current) return;
    const g = gesture.current;
    if (g.canDraw && motion.current) {
      const samples = e.nativeEvent.getCoalescedEvents?.() || [];
      for (const ev of samples.length ? samples : [e.nativeEvent]) {
        const r = e.currentTarget.getBoundingClientRect();
        recordMotion(motion.current, Math.round(Math.max(0,Math.min(WIDTH,(ev.clientX-r.left)*WIDTH/r.width))), Math.round(Math.max(0,Math.min(HEIGHT,(ev.clientY-r.top)*HEIGHT/r.height))), ev.timeStamp);
      }
    }
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) >= 5) g.moved = true;
    if (!g.canDraw || !g.moved) return;
    const p = point(e), last = points.current.at(-1)!;
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 3) {
      points.current = extendPath(points.current, p);
      setUsed(pathLength(points.current));
    }
    draw();
  }
  function finish(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active.current || e.pointerId !== pointer.current || !gesture.current) return;
    const g = gesture.current;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) >= 5) g.moved = true;
    const clickLink = g.mouse && !g.moved && g.hit?.url && hit(e)?.id === g.hit.id;
    active.current = false;
    pointer.current = null;
    gesture.current = null;
    if (clickLink) {
      points.current = [];
      window.open(g.hit!.url, "_blank", "noopener,noreferrer");
    } else if (!g.mouse && !g.moved && g.hit && hit(e)?.id === g.hit.id) {
      setSelected(g.hit); setTouchReveal(true);
      const r = e.currentTarget.getBoundingClientRect();
      setHoverAt({ x: 100 * (e.clientX - r.left) / r.width, y: 100 * (e.clientY - r.top) / r.height });
      points.current = [];
    } else if (g.canDraw && g.moved) {
      // Touch and pen always draw; a desktop drag never opens a visitor link.
      points.current = extendPath(points.current, point(e));
      setUsed(pathLength(points.current));
      setDraft(points.current);
      if (motion.current) setDraftMotion(finishMotion(motion.current, ...point(e), e.timeStamp));
    }
    motion.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    draw();
  }
  async function submit() {
    if (sending) return;
    setSending(true);
    try {
      const link = pending.current?.url ?? profileURL(kind, url);
      validate(pending.current?.points ?? draft, link);
      if (sharedMode) {
        if (!pending.current)
          pending.current = {
            requestId: crypto.randomUUID(),
            points: structuredClone(draft),
            url: link,
            motion: draftMotion,
          };
        sessionStorage.setItem(
          "47-strokes-pending",
          JSON.stringify(pending.current),
        );
        const saved = pending.current;
        applyShared(
          await addShared(saved.points, saved.url, saved.requestId, botToken, saved.motion),
        );
        pending.current = null;
        sessionStorage.removeItem("47-strokes-pending");
      } else {
        const result = accept(strokes, next, draft, link, Date.now());
        setA(result.strokes.slice(0, 24));
        setB(result.strokes.slice(24));
        setNext(result.nextAllowed);
        setNow(Date.now());
      }
      setDraft([]);
      setUrl("");
      setKind("manual");
      setError("");
    } catch (e) {
      if (!(e instanceof SubmissionError && e.uncertain)) {
        pending.current = null;
        sessionStorage.removeItem("47-strokes-pending");
      }
      setError((e as Error).message);
      if (sharedMode) {
        try {
          applyShared(await loadShared());
        } catch {}
      }
    } finally {
      setBotToken("");
      setBotNonce((n) => n + 1);
      setSending(false);
    }
  }
  const reset = () => {
    setA(initial.slice(0, 24));
    setB(initial.slice(24));
    setNext(0);
    setDraft([]);
    setUrl("");
    setKind("manual");
    setSelected(null);
    setError("");
    setNow(Date.now());
  };
  if (window.location.pathname === "/strokes") return <FileCard><div className="project minimalcanvas allstrokes"><StrokeList strokes={strokes} all /><p className="error" role="status">{error}</p></div></FileCard>;
  return (
    <FileCard>
      <div className="project minimalcanvas">
        <header className="pageheader"><h1><img src="/logo.png" alt="47 strokes" width="640" height="516" /></h1></header>
        <p className="canvasavailability" role="status">{sharedMode && loaded && !writesEnabled ? "Submissions are not open yet." : ""}</p>
        <div className="canvasframe">
        <canvas aria-label="Drag to draw one continuous stroke. On desktop, hover to see a link and click to open it in a new tab." ref={canvas} width={WIDTH} height={HEIGHT}
          onPointerDown={down} onPointerMove={move} onPointerUp={finish}
          onPointerLeave={() => { if (!active.current && !touchReveal) setSelected(null); }}
          onPointerCancel={(e) => { if (e.pointerId !== pointer.current) return; active.current = false; pointer.current = null; gesture.current = null; motion.current = null; points.current = []; draw(); }} />
        {selected && <div className={`strokehover${touchReveal ? " touchreveal" : ""}`} role={touchReveal ? "group" : "tooltip"} style={{ left: `clamp(8px, ${hoverAt.x}%, calc(100% - 228px))`, top: `clamp(8px, calc(${hoverAt.y}% + 14px), calc(100% - 44px))` }} title={selected.url || "No link"}><div className="hoverbody">{touchReveal && selected.url ? <a href={selected.url} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label={`Open ${selected.url}`}>{selected.url}</a> : <span>{selected.url || "No link"}</span>}{selected.at && <time dateTime={new Date(selected.at).toISOString()}>{formatStrokeTime(selected.at)}</time>}</div></div>}
        </div>
        <div className="canvascontrols">
          <div className="tools">
            <FileButton disabled={!ready || !draft.length || !!pending.current} onClick={() => { setDraft([]); setDraftMotion(undefined); setError(""); }}>Undo</FileButton>
          </div>
          <span className="limit" aria-label="Stroke length remaining">{Math.max(0, MAX_LENGTH - used).toFixed(0)} / {MAX_LENGTH}</span>
        </div>
        <ProfilePicker kind={kind} setKind={setKind} value={url} setValue={setUrl} disabled={!ready || !!pending.current} />
        <div className="tools submittools">
          {sharedMode && pending.current ? <FileButton disabled={sending} onClick={submit}>{sending ? "Confirming…" : "Retry saved submission"}</FileButton> :
          <FileButton className={waiting ? "cooldownbtn" : ""} aria-label={waiting ? `Canvas resting, ${remaining(next, now)} left` : undefined} disabled={!ready || waiting || draft.length < 2 || (sharedMode && !botToken)} onClick={submit}>{waiting ? remaining(next, now) : "Add stroke"}</FileButton>}
        </div>
        {sharedMode && <div className="verificationslot">{(writesEnabled || !!pending.current) && siteKey && <BotCheck siteKey={siteKey} action="stroke" onToken={setBotToken} nonce={botNonce} collapseOnVerified />}</div>}
        <p className="error" role="status">{error}</p>
        <StrokeList strokes={strokes} />
        <details className="whyexists">
          <summary>Why This Exists?</summary>
          <p>This canvas captures a rotating gallery of exactly 47 strokes. When a new stroke is added, the least recently added one disappears, keeping the collection in constant flux. Why forty-seven? Because I love the number. Why does this exist? So people visiting my site have something to interact with and a place to leave their trace.</p>
        </details>
        {!sharedMode && <details><summary>Private prototype controls</summary><FileButton onClick={reset}>Reset private demo</FileButton></details>}
      </div>
    </FileCard>
  );
}
