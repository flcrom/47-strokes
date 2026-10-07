import React, { useEffect, useRef, useState } from "react";
import { FileCard, Header, Closing, Caption, FileButton } from "./ui";
import {
  seed,
  validate,
  accept,
  remaining,
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
  const modal = useRef<HTMLDialogElement>(null),
    background = useRef<HTMLDivElement>(null),
    pointer = useRef<number | null>(null);
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
    [botNonce, setBotNonce] = useState(0),
    [reporting, setReporting] = useState<string | null>(null),
    [reportToken, setReportToken] = useState("");
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
      ctx.strokeStyle = s.id === "draft" ? "#777" : ageShade(i, strokes.length);
      ctx.lineWidth = s.id === selected?.id ? 4 : 2;
      ctx.beginPath();
      s.points.forEach((p, i) =>
        i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
      );
      ctx.stroke();
    }
  }
  useEffect(draw, [a, b, draft, selected]);
  useEffect(() => setUsed(pathLength(draft)), [draft]);
  useEffect(() => {
    if (!waiting) return;
    const prior = document.activeElement as HTMLElement | null;
    window.scrollTo(0, 0);
    document.body.scrollIntoView({ block: "start" });
    modal.current?.showModal();
    modal.current?.focus({ preventScroll: true });
    return () => {
      modal.current?.close();
      prior?.focus();
    };
  }, [waiting]);
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
      waiting ||
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
  return (
    <FileCard>
      <div className="project">
        <div ref={background} {...(waiting ? { inert: "" } : {})}>
          <Header title="47 strokes" intro="One line in. One line out." />
          <div className="eyebrow">A canvas that makes room</div>
          <div className="demo">
            {sharedMode
              ? "Shared canvas · 47 marks, always"
              : "Private tryout · on this device only · no shared backend yet"}
          </div>
          {sharedMode && loaded && !writesEnabled && (
            <p role="status">
              The canvas is read-only while launch checks finish. Submissions
              are not open yet.
            </p>
          )}
          <div className="canvasbar">
            <span>47 marks · one shared idea</span>
            <span>Newest → black</span>
          </div>
          <canvas
            aria-label="Drawing canvas. Draw one continuous stroke, or switch to inspect links."
            ref={canvas}
            width={WIDTH}
            height={HEIGHT}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={finish}
            onPointerCancel={(e) => {
              if (e.pointerId !== pointer.current) return;
              active.current = false;
              pointer.current = null;
              points.current = [];
              setDraft([]);
              draw();
            }}
          />
          <div className="tools">
            <FileButton
              disabled={!loaded || sending || waiting}
              onClick={() => {
                setInspect(!inspect);
                setSelected(null);
              }}
            >
              {inspect ? "Draw a stroke" : "Inspect links"}
            </FileButton>
            <FileButton
              disabled={!ready || !draft.length || waiting || !!pending.current}
              onClick={() => {
                if (pending.current) {
                  setError(
                    "Confirm the pending submission before changing the draft.",
                  );
                  return;
                }
                setDraft([]);
                setError("");
              }}
            >
              Undo draft
            </FileButton>
          </div>
          <p className="hint">
            {inspect
              ? "Tap a line to inspect its link. Desktop hover works in either mode."
              : "One press, one continuous line. A circle is fine. Release to finish. Draw anywhere. Length limit: one canvas perimeter. Newest is black; older lines fade one shade per addition."}
          </p>
          {selected && (
            <div className="linkbox">
              {selected.url ? (
                <>
                  <span>{new URL(selected.url).hostname}</span>
                  <span className="fullurl">{selected.url}</span>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                  >
                    Open link ↗
                  </a>
                  <small>Visitor link. Not checked or endorsed.</small>
                  {sharedMode &&
                    (writesEnabled || !!pending.current) &&
                    siteKey && (
                      <FileButton
                        onClick={() => {
                          setReporting(selected.id);
                          setReportToken("");
                        }}
                      >
                        Report link
                      </FileButton>
                    )}
                  {reporting === selected.id && (
                    <>
                      <BotCheck
                        siteKey={siteKey}
                        action="report"
                        onToken={setReportToken}
                        nonce={botNonce}
                      />
                      <FileButton
                        disabled={!reportToken || sending}
                        onClick={async () => {
                          setSending(true);
                          try {
                            const r = await fetch("/api/report", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: selected.id,
                                token: reportToken,
                              }),
                            });
                            if (!r.ok)
                              throw Error(
                                (await r.json()).error ||
                                  "Report did not go through.",
                              );
                            setError("Link reported for owner review.");
                            setReporting(null);
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setSending(false);
                            setReportToken("");
                            setBotNonce((n) => n + 1);
                          }
                        }}
                      >
                        Send report
                      </FileButton>
                    </>
                  )}
                </>
              ) : (
                <span>This line has no link.</span>
              )}
            </div>
          )}
          {sharedMode && (writesEnabled || !!pending.current) && siteKey && (
            <BotCheck
              siteKey={siteKey}
              action="stroke"
              onToken={setBotToken}
              nonce={botNonce}
            />
          )}
          <ProfilePicker
            kind={kind}
            setKind={setKind}
            value={url}
            setValue={setUrl}
            disabled={!ready || waiting || !!pending.current}
          />
          {sharedMode && pending.current && !waiting && (
            <div className="tools">
              <FileButton disabled={sending} onClick={submit}>
                {sending ? "Confirming…" : "Retry saved submission"}
              </FileButton>
              <span>
                Checks your original submission without adding it twice.
              </span>
            </div>
          )}
          <div className="tools">
            <FileButton
              disabled={
                !ready ||
                waiting ||
                draft.length < 2 ||
                (sharedMode && !botToken) ||
                inspect ||
                !!pending.current
              }
              onClick={submit}
            >
              Add my stroke
            </FileButton>
            <span className="limit" aria-live="off">
              <strong>{used.toFixed(1)}</strong> px drawn ·{" "}
              {Math.max(0, MAX_LENGTH - used).toFixed(1)} left
            </span>
          </div>
          <p className="unitnote">
            Logical canvas pixels: path distance, not filled area.{" "}
            {MAX_LENGTH.toLocaleString()} per stroke.
          </p>
          <p className="error" role="status">
            {error}
          </p>
          <Caption>
            {sharedMode
              ? "Accepted strokes are shared with everyone. Visitor links are not checked or endorsed."
              : "Changes last only while this prototype stays open. Reload resets the demo."}
          </Caption>
          <section className="rules">
            <h2>The canvas makes room.</h2>
            <div>
              <p>
                <b>01 · Draw anywhere</b>One continuous gesture. Length is
                limited to one canvas perimeter.
              </p>
              <p>
                <b>02 · Keep the shape</b>No snapping, smoothing or moving your
                mark. The newest enters in black.
              </p>
              <p>
                <b>03 · Let it age</b>47 marks remain. Each new addition
                lightens the older ones and removes the oldest.
              </p>
              <p>
                <b>04 · Take a breath</b>After a stroke, the canvas rests for
                five minutes.
              </p>
            </div>
          </section>
          {!sharedMode && (
            <details>
              <summary>Private prototype controls</summary>
              <p>
                Resets only this device's demo. Real shared storage, atomic
                server cooldown, moderation and abuse checks are not deployed.
              </p>
              <FileButton onClick={reset} disabled={!ready}>
                Reset private demo
              </FileButton>
            </details>
          )}
          <Closing>
            {sharedMode
              ? "One shared drawing. One new stroke every five minutes."
              : "Frontend prototype. No shared canvas or server cooldown yet."}
          </Closing>
        </div>
        {waiting && (
          <dialog
            ref={modal}
            tabIndex={-1}
            onCancel={(e) => e.preventDefault()}
            className="rest"
            role="dialog"
            aria-modal="true"
            aria-label="Canvas cooldown"
          >
            <svg
              className="ghostcanvas"
              viewBox="0 0 960 480"
              aria-hidden="true"
            >
              {strokes.map((s, i) => (
                <polyline
                  key={s.id}
                  points={s.points.map((p) => p.join(",")).join(" ")}
                  fill="none"
                  stroke={ageShade(i, strokes.length)}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
            <div className="restinner">
              <p>the canvas is resting</p>
              <div
                className="clock"
                aria-label={remaining(next, now) + " remaining"}
              >
                {remaining(next, now)}
              </div>
              <p>one stroke every five minutes</p>
              <small>Drafts stay until you submit or undo.</small>
              {sharedMode && pending.current && (
                <FileButton disabled={sending} onClick={submit}>
                  Confirm pending submission
                </FileButton>
              )}
              {!sharedMode && (
                <details>
                  <summary>Private prototype</summary>
                  <p>
                    This countdown is device-local, not a global server lock.
                  </p>
                  <FileButton
                    onClick={() => {
                      setNext(0);
                      setNow(Date.now());
                    }}
                  >
                    Skip timer (testing only)
                  </FileButton>
                  <FileButton onClick={reset}>Reset private demo</FileButton>
                </details>
              )}
            </div>
          </dialog>
        )}
      </div>
    </FileCard>
  );
}
