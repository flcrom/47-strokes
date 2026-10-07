import type { Stroke } from "./core.mjs";
import { marks } from "./profile-marks";
export function serviceMark(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password) return "Link";
    const h = u.hostname.toLowerCase();
    if (h === "github.com" || h === "www.github.com") return "GitHub";
    if (["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(h)) return "X";
    if (["discord.com", "www.discord.com", "discordapp.com", "discord.gg"].includes(h)) return "Discord";
    if (h === "signal.me") return "Signal";
    if (h === "linkedin.com" || h === "www.linkedin.com") return "LinkedIn";
    if (h === "instagram.com" || h === "www.instagram.com") return "Instagram";
  } catch {}
  return "Link";
}
export function strokePreview(points: number[][]) {
  if (!points.length) return "";
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
  const scale = Math.min(44 / Math.max(width, 1), 44 / Math.max(height, 1));
  return points.map(([x, y]) => `${(x - minX) * scale + (64 - width * scale) / 2},${(y - minY) * scale + (64 - height * scale) / 2}`).join(" ");
}
export function StrokeList({ strokes, all = false }: { strokes: Stroke[]; all?: boolean }) {
  const visible = [...strokes].filter(s => !s.id.startsWith("intro-draw-one-line-") && !s.id.startsWith("seed-")).reverse().slice(0, all ? 47 : 10);
  return <section className="strokelist" aria-label={all ? "All visitor strokes, newest first" : "Recent visitor strokes, newest first"}>
    <div className="listheading"><h2>{all ? "All visitor strokes" : "Recent strokes"}</h2>{!all && <a href="/strokes">View all</a>}</div>
    {!visible.length && <p className="nolink">No visitor strokes yet.</p>}
    <ol>{visible.map((stroke) => <li key={stroke.id}>
      <span className="listlinkicon" aria-hidden="true" data-service={serviceMark(stroke.url)} dangerouslySetInnerHTML={{ __html: marks[serviceMark(stroke.url)] || marks.Link }} />
      {stroke.url ? <a className="strokelink" href={stroke.url} target="_blank" rel="noopener noreferrer nofollow ugc" title={stroke.url}>{stroke.url}</a> : <span className="strokelink nolink">No link</span>}
      <svg className="strokepreview" viewBox="0 0 64 64" role="img" aria-label="Individual stroke"><polyline points={strokePreview(stroke.points)} fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </li>)}</ol>
  </section>;
}
