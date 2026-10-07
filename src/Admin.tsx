import { useEffect, useState } from "react";
import { FileCard, Header, FileButton } from "./ui";
export function Admin() {
  const [rows, setRows] = useState<
      { id: string; url: string; reports: number }[]
    >([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await fetch("/admin/api/links", { cache: "no-store" });
      if (!r.ok)
        throw Error(
          "Owner sign-in is required, or the removal page is unavailable.",
        );
      setRows((await r.json()).strokes);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function remove(id: string) {
    if (
      !window.confirm(
        "Remove this link from the shared canvas? The drawn stroke stays.",
      )
    )
      return;
    setBusy(true);
    try {
      const r = await fetch("/admin/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok)
        throw Error((await r.json()).error || "Could not remove this link.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <FileCard>
      <Header
        title="Link review"
        intro="Private owner page. Remove a link without changing the drawing."
      />
      <p role="status">{error}</p>
      {rows.length === 0 ? (
        <p>No linked strokes are waiting.</p>
      ) : (
        rows
          .sort((a, b) => b.reports - a.reports)
          .map((s) => (
            <section className="linkbox" key={s.id}>
              <span className="fullurl">{s.url}</span>
              <span>{s.reports} reports</span>
              <FileButton disabled={busy} onClick={() => remove(s.id)}>
                Remove link
              </FileButton>
            </section>
          ))
      )}
      <a href="/">Back to the canvas</a>
    </FileCard>
  );
}
