import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "./worker/canvas.mjs";
import { readmeImage, README_SLICES } from "./worker/readme.mjs";

test("readme slices tile the canvas without gaps", () => {
  assert.equal(README_SLICES.length, 7);
  assert.equal(README_SLICES[0][0], 0);
  assert.equal(README_SLICES.at(-1)[1], 960);
  for (let i = 1; i < README_SLICES.length; i++)
    assert.equal(README_SLICES[i][0], README_SLICES[i - 1][1]);
});

test("readme slices render a windowed canvas with overlays", () => {
  const svg = readmeImage(initialState(), 0);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="26" height="480" viewBox="0 0 26 480"'));
  assert.ok(svg.includes("data:image/png;base64,"), "logo overlay baked in");
  assert.ok(svg.includes("<polyline"), "live strokes included");
  assert.ok(svg.includes('rx="10"'), "icon chips baked in");
  assert.equal(readmeImage(initialState(), 7), null);
});
