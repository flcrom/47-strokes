import React, { useEffect, useRef, useState } from "react";
import { FileCard, FileButton } from "./ui";
import {
  seed,
  validate,
  accept,
  ageShade,
  nearestStroke,
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
    [inspect, setInspect] = useState(false),
    [used, setUsed] = useState(0);
  const pointer = useRef<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    active = useRef(false),
    points = useRef<number[][]>([]);
  const [loaded, setLoaded] = useState(!sharedMode),
    [sending, setSending] = useState(false);
  const pending = useRef<{
    requestId: string;
    points: number[][];
    url: string;
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
  useEffect(draw, [a, b, draft, selected]);
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
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (
      !loaded ||
      sending ||
      (waiting && !inspect) ||
      active.current ||
      !e.isPrimary ||
      pending.current
    )
      return;
    const p = point(e);
    if (inspect) {
      setSelected(nearestStroke(strokes, p));
      return;
    }
    if (!writesEnabled) return;
    if (draft.length) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    setError("");
    active.current = true;
    pointer.current = e.pointerId;
    points.current = [p];
    setUsed(0);
    e.currentTarget.setPointerCapture(e.pointerId);
    draw();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active.current) {
      if (e.pointerType !== "touch" && !waiting)
        setSelected(nearestStroke(strokes, point(e)));
      return;
    }
    if (e.pointerId !== pointer.current) return;
    const p = point(e),
      last = points.current.at(-1)!;
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 3) {
      points.current = extendPath(points.current, p);
      setUsed(pathLength(points.current));
    }
    draw();
  }
  function finish(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active.current || e.pointerId !== pointer.current) return;
    const p = point(e);
    points.current = extendPath(points.current, p);
    setUsed(pathLength(points.current));
    active.current = false;
    pointer.current = null;
    setDraft(points.current);
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
          };
        sessionStorage.setItem(
          "47-strokes-pending",
          JSON.stringify(pending.current),
        );
        const saved = pending.current;
        applyShared(
          await addShared(saved.points, saved.url, saved.requestId, botToken),
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
  if (window.location.pathname === "/strokes") return <FileCard><div className="project minimalcanvas allstrokes"><StrokeList strokes={strokes} all />{error && <p role="status">{error}</p>}</div></FileCard>;
  return (
    <FileCard>
      <div className="project minimalcanvas">
        <header className="pageheader"><h1>47 strokes</h1></header>
        {sharedMode && loaded && !writesEnabled && <p role="status">Submissions are not open yet.</p>}
        <canvas aria-label="Draw one continuous stroke. Inspect links to explore existing strokes." ref={canvas} width={WIDTH} height={HEIGHT}
          onPointerDown={down} onPointerMove={move} onPointerUp={finish}
          onPointerCancel={(e) => { if (e.pointerId !== pointer.current) return; active.current = false; pointer.current = null; points.current = []; setDraft([]); draw(); }} />
        <div className="canvascontrols">
          <div className="tools">
            <FileButton disabled={!loaded || sending} onClick={() => { setInspect(!inspect); setSelected(null); }}>{inspect ? "Draw" : "Inspect links"}</FileButton>
            <FileButton disabled={!ready || !draft.length || !!pending.current} onClick={() => { setDraft([]); setError(""); }}>Undo</FileButton>
          </div>
          <span className="limit" aria-label="Stroke length remaining">{Math.max(0, MAX_LENGTH - used).toFixed(0)} / {MAX_LENGTH}</span>
        </div>
        {selected && <div className="linkbox">{selected.url ? <><span>{new URL(selected.url).hostname}</span><a href={selected.url} target="_blank" rel="noopener noreferrer nofollow ugc" title="Visitor link, not checked or endorsed">Open link ↗</a></> : <span>No link</span>}</div>}
        <ProfilePicker kind={kind} setKind={setKind} value={url} setValue={setUrl} disabled={!ready || !!pending.current} />
        {sharedMode && (writesEnabled || !!pending.current) && siteKey && <BotCheck siteKey={siteKey} action="stroke" onToken={setBotToken} nonce={botNonce} />}
        <div className="tools submittools">
          {sharedMode && pending.current ? <FileButton disabled={sending} onClick={submit}>{sending ? "Confirming…" : "Retry saved submission"}</FileButton> :
          <FileButton disabled={!ready || waiting || draft.length < 2 || (sharedMode && !botToken) || inspect} onClick={submit}>{waiting ? "Canvas resting" : "Add my stroke"}</FileButton>}
        </div>
        {error && <p className="error" role="status">{error}</p>}
        <StrokeList strokes={strokes} />
        {!sharedMode && <details><summary>Private prototype controls</summary><FileButton onClick={reset}>Reset private demo</FileButton></details>}
      </div>
    </FileCard>
  );
}
