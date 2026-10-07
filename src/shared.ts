import type { Stroke } from "./core.mjs";
export type SharedState = {
  writesEnabled?: boolean;
  turnstileSiteKey?: string;
  version: number;
  strokes: Stroke[];
  nextAllowed: number;
  serverNow: number;
};
export async function loadShared(): Promise<SharedState> {
  const r = await fetch("/api/canvas", {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok)
    throw Error("The shared canvas could not load. Your draft is kept.");
  return r.json();
}
export class SubmissionError extends Error {
  uncertain: boolean;
  constructor(message: string, uncertain = false) {
    super(message);
    this.uncertain = uncertain;
  }
}
export async function addShared(
  points: number[][],
  url: string,
  requestId: string,
  token: string,
): Promise<SharedState> {
  let r: Response;
  try {
    r = await fetch("/api/strokes", {
      method: "POST",
      signal: AbortSignal.timeout(12000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points, url, requestId, token }),
    });
  } catch {
    throw new SubmissionError(
      "Could not confirm the submission. Retry the same saved submission to check it safely.",
      true,
    );
  }
  let body;
  try {
    body = await r.json();
  } catch {
    throw new SubmissionError(
      "Could not read the confirmation. Retry the same saved submission to check it safely.",
      true,
    );
  }
  if (!r.ok)
    throw new SubmissionError(
      body.error || "The stroke was not accepted. Your draft is kept.",
      r.status >= 500,
    );
  return body;
}
