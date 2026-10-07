import { useEffect, useRef } from "react";
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}
export function BotCheck({
  siteKey,
  action,
  onToken,
  nonce,
}: {
  siteKey: string;
  action: string;
  onToken: (t: string) => void;
  nonce: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey) return;
    let id: string | undefined,
      closed = false;
    const render = () => {
      if (!closed && root.current && window.turnstile)
        id = window.turnstile.render(root.current, {
          sitekey: siteKey,
          action,
          theme: "light",
          size: "compact",
          callback: onToken,
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
    };
    if (window.turnstile) render();
    else {
      let script = document.querySelector<HTMLScriptElement>("#turnstile-api");
      if (!script) {
        script = document.createElement("script");
        script.id = "turnstile-api";
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render, { once: true });
    }
    return () => {
      closed = true;
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, action, nonce]);
  return <div ref={root} aria-label="Bot check" />;
}
