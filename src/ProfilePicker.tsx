import React, { useState, useEffect, useRef } from "react";
import { profiles } from "./profiles.mjs";
import { marks } from "./profile-marks";
function Mark({ name }: { name: string }) {
  return (
    <span
      className="profilemark"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: marks[name] || "" }}
    />
  );
}
export function ProfilePicker({
  kind,
  setKind,
  value,
  setValue,
  disabled,
}: {
  kind: string;
  setKind: (k: string) => void;
  value: string;
  setValue: (v: string) => void;
  disabled: boolean;
}) {
  const [slots, setSlots] = useState(() =>
    profiles.filter((p) => p.id !== kind && p.id !== "monkeytype").map((p) => p.id),
  );
  useEffect(() => {
    setSlots((old) =>
      old.includes(kind)
        ? profiles.filter((p) => p.id !== kind && p.id !== "monkeytype").map((p) => p.id)
        : old,
    );
  }, [kind]);
  function choose(id: string) {
    setSlots((old) => old.map((x) => (x === id ? kind : x)));
    setKind(id);
    setValue("");
  }
  const container = useRef<HTMLElement>(null);
  const [visibleCount, setVisibleCount] = useState(6);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setVisibleCount(Math.max(1, Math.floor((entry.contentRect.width + 12) / 74))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const p = profiles.find((p) => p.id === kind)!;
  return (
    <section className="picker" ref={container}>
      <div className="profilefield">
        <div className="profileinputmark">
          {kind === "monkeytype" ? (
            <span aria-hidden="true">MT</span>
          ) : (
            <Mark name={p.name} />
          )}
        </div>
        <div className="profileentry">
          {p.prefix && <span className="profileprefix">{p.prefix}</span>}
          <input
            id="profile-input"
            disabled={disabled}
            value={value}
            maxLength={
              p.link
                ? 300
                : kind === "github"
                  ? 39
                  : kind === "x"
                    ? 15
                    : kind === "linkedin"
                      ? 100
                      : kind === "instagram"
                        ? 30
                        : 16
            }
            onChange={(e) => setValue(e.target.value)}
            placeholder={p.hint}
            title={p.prefix ? p.prefix + value : value}
            type={p.link ? "url" : "text"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label={
              p.link
                ? `${p.name} HTTPS link`
                : `${p.name} username or profile slug`
            }
          />
        </div>
      </div>
      <div className="profilechoices" role="group" aria-label="Link type">
        {slots
          .map((id) => profiles.find((p) => p.id === id)!)
          .filter((p) => p.id !== "monkeytype")
          .slice(0, visibleCount)
          .map((p, index) => (
            <div className="profilecell" key={index}>
              <button
                type="button"
                disabled={disabled}
                aria-label={p.name}
                aria-pressed={p.id === kind}
                onClick={() => {
                  choose(p.id);
                }}
              >
                <Mark name={p.name} />
              </button>
            </div>
          ))}
      </div>

    </section>
  );
}
