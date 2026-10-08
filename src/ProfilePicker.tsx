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
  const [chosen, setChosen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  function choose(id: string) {
    if (id !== kind || !chosen) setValue("");
    setKind(id);
    setChosen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  const p = profiles.find((p) => p.id === kind)!;
  return (
    <section className={"picker" + (chosen ? " chosen" : " idle")}>
      <div className="profilechoices" role="group" aria-label="Link type">
        {profiles
          .filter((p) => p.id !== "monkeytype")
          .map((p) => (
            <div className="profilecell" key={p.id}>
              <button
                type="button"
                disabled={disabled}
                aria-label={p.name}
                aria-pressed={chosen && p.id === kind}
                onClick={() => {
                  choose(p.id);
                }}
              >
                <Mark name={p.name} />
              </button>
            </div>
          ))}
      </div>
      <div className="profilefield">
        <div className="profileinputmark">
          {!chosen ? null : kind === "monkeytype" ? (
            <span aria-hidden="true">MT</span>
          ) : (
            <Mark name={p.name} />
          )}
        </div>
        <div className="profileentry">
          {p.prefix && <span className="profileprefix">{p.prefix}</span>}
          <input
            id="profile-input"
            disabled={disabled || !chosen}
            ref={inputRef}
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
                        : kind === "reddit"
                          ? 20
                          : kind === "telegram"
                            ? 32
                            : 16
            }
            style={chosen && p.prefix && !value ? { width: `${p.hint.length + 2}ch`, flex: "none" } : undefined}
            onChange={(e) => setValue(e.target.value)}
            placeholder={chosen ? p.hint : ""}
            title={p.prefix ? p.prefix + value : value}
            type={p.link && !(p as any).hybrid ? "url" : "text"}
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

    </section>
  );
}
