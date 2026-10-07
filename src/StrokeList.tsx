import type { Stroke } from "./core.mjs";
import { marks } from "./profile-marks";
export function strokePreview(points: number[][]) {
  if (!points.length) return "";
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
  const scale = Math.min(44 / Math.max(width, 1), 44 / Math.max(height, 1));
  return points.map(([x, y]) => `${(x - minX) * scale + (64 - width * scale) / 2},${(y - minY) * scale + (64 - height * scale) / 2}`).join(" ");
}
export function StrokeList({ strokes, all = false }: { strokes: Stroke[]; all?: boolean }) {
  const visible = [...strokes].reverse().slice(0, all ? 47 : 10);
  return <section className="strokelist" aria-label={all ? "All 47 strokes, newest first" : "Recent 10 strokes, newest first"}>
    <div className="listheading"><h2>{all ? "All 47 strokes" : "Recent strokes"}</h2>{!all && <a href="/strokes">View all</a>}</div>
    <ol>{visible.map((stroke) => <li key={stroke.id}>
      <span className="listlinkicon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: marks.Link }} />
      {stroke.url ? <a className="strokelink" href={stroke.url} target="_blank" rel="noopener noreferrer nofollow ugc" title={stroke.url}>{stroke.url}</a> : <span className="strokelink nolink">No link</span>}
      <svg className="strokepreview" viewBox="0 0 64 64" role="img" aria-label="Individual stroke"><polyline points={strokePreview(stroke.points)} fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </li>)}</ol>
  </section>;
}
