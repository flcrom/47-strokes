import React, { useState, useEffect } from "react";
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
    profiles.filter((p) => p.id !== kind).map((p) => p.id),
  );
  useEffect(() => {
    setSlots((old) =>
      old.includes(kind)
        ? profiles.filter((p) => p.id !== kind).map((p) => p.id)
        : old,
    );
  }, [kind]);
  function choose(id: string) {
    setSlots((old) => old.map((x) => (x === id ? kind : x)));
    setKind(id);
    setValue("");
  }
  const p = profiles.find((p) => p.id === kind)!;
  return (
    <section className="picker">
      <div className="sectiontop">
        <label htmlFor="profile-input">Leave a link, if you like.</label>
        <span>Optional</span>
      </div>
      <div className="profilechoices" role="group" aria-label="Link type">
        {slots
          .map((id) => profiles.find((p) => p.id === id)!)
          .filter((p) => p.id !== "monkeytype")
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
              <span>{p.name}</span>
            </div>
          ))}
      </div>
      {slots.includes("monkeytype") && (
        <button
          className="legacyprofile"
          type="button"
          disabled={disabled}
          aria-pressed={kind === "monkeytype"}
          onClick={() => {
            choose("monkeytype");
          }}
        >
          <svg viewBox="0 0 26 24" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M5 9h1m3 0h1m3 0h1m3 0h1M5 12h1m3 0h1m3 0h1m3 0h1M6 16h12" />
          </svg>
          <span>Monkeytype</span>
        </button>
      )}
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
      <small aria-live="polite">
        {p.name} selected.{" "}
        {p.help ||
          "Only the link you enter is attached. No account connection."}
      </small>
    </section>
  );
}
