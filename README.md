# 47 strokes

One line in. One line out.

A monochrome drawing project with 47 retained marks. One continuous gesture can draw anywhere on a 960 × 480 canvas, using up to 2,880 logical pixels of path distance. The newest mark enters in black. Older marks lighten by relative age; the oldest leaves when a new mark arrives. A five-minute cooldown follows submission.

Optional links use a manual HTTPS field by default, or icon choices for GitHub, X, LinkedIn and Monkeytype usernames. Desktop hover and Inspect links mode reveal a mark's URL. The live counter measures path length, not filled area.

Three original isometric SVG motion studies use bounded pointer-responsive springs. They stop at rest, offscreen or when the tab is hidden. Reduced motion holds the resting pose.

## Run locally

Requires Node 20.19+ or 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

```sh
npm test
npm run build
npm run preview
```

The lockfile pins dependencies. No private component package or account credentials are needed.

## Current boundary

This is a runnable frontend prototype, not a shared service. State exists only in the open session; reloading resets it. There is no shared backend, server-authoritative global cooldown, production persistence or moderation service. The private testing controls can skip the local timer. Public deployment, database and GitHub profile integration are not included.

## Tests

Geometry, exact path retention, perimeter clipping, 47 shades and cooldown are tested in `core.test.mjs`. Profile path and input boundaries are tested in `profiles.test.mjs`.

## Motion inspiration

Hairline by Lucas Marques: https://hairline.lucasmarkes.com/
Original reference: https://x.com/lucasmarkes__/status/2105386342540579198
The motion studies here use original geometry. No Hairline source code is bundled.
