import { useEffect, useRef, useState } from "react";
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}
export function BotCheck({ siteKey, action, onToken, nonce }: {
  siteKey: string; action: string; onToken: (t: string) => void; nonce: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    if (!siteKey) return;
    let id: string | undefined, closed = false;
    let script: HTMLScriptElement | null = null;
    setStatus("loading");
    onToken("");
    const fail = () => { if (!closed) { onToken(""); setStatus("failed"); } };
    const timeout = window.setTimeout(fail, 15000);
    const render = () => {
      if (closed || !root.current || !window.turnstile || id) return;
      try {
        clearTimeout(timeout);
        id = window.turnstile.render(root.current, {
          sitekey: siteKey, action, theme: "light", size: "flexible",
          callback: (token: string) => { if (!closed) { clearTimeout(timeout); onToken(token); setStatus("ready"); } },
          "expired-callback": fail,
          "error-callback": fail,
        });
      } catch { fail(); }
    };
    if (window.turnstile) render();
    else {
      script = document.querySelector<HTMLScriptElement>("#turnstile-api");
      if (attempt && script) { script.remove(); script = null; }
      if (!script) {
        script = document.createElement("script");
        script.id = "turnstile-api";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.addEventListener("load", render, { once: true });
        script.addEventListener("error", fail, { once: true });
        document.head.appendChild(script);
      } else {
        script.addEventListener("load", render, { once: true });
        script.addEventListener("error", fail, { once: true });
      }
    }
    return () => {
      closed = true;
      clearTimeout(timeout);
      script?.removeEventListener("load", render);
      script?.removeEventListener("error", fail);
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, action, nonce, attempt]);
  return <div className="botcheck">
    <div ref={root} aria-label="Bot check" />
    {status === "loading" && <small role="status">Checking…</small>}
    {status === "failed" && <div className="tools" role="status"><small>Bot check unavailable.</small><button type="button" className="file-button" onClick={() => setAttempt((n) => n + 1)}>Retry bot check</button></div>}
  </div>;
}
