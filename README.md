# 47 strokes

One line in. One line out.

A monochrome drawing project with 47 retained marks. One continuous gesture can draw anywhere on a 960 × 480 canvas, using up to 2,880 logical pixels of path distance. The newest mark enters in black. Older marks lighten by relative age; the oldest leaves when a new mark arrives. A five-minute cooldown follows submission.

Optional links use a manual HTTPS field by default, or reviewed icon choices for GitHub, X, LinkedIn and Instagram usernames, plus Discord profile links and Signal share links. Existing Monkeytype username support is retained separately pending icon review. Desktop hover and Inspect links mode reveal a mark's URL. The live counter measures path length, not filled area.

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

This is a runnable frontend prototype, not a shared service. State exists only in the open session; reloading resets it. There is no shared backend, server-authoritative global cooldown, production persistence or moderation service. The private testing controls can skip the local timer. A custom-domain static deployment is planned separately. Database and shared-service functionality are not included.

## Tests

Geometry, exact path retention, perimeter clipping, 47 shades and cooldown are tested in `core.test.mjs`. Profile path and input boundaries are tested in `profiles.test.mjs`.

## Motion direction

The rejected stock Hairline demo is removed. No replacement motion is included. Hairline is reference/inspiration only. No Hairline code or creation kernel is used.

## Icon sources

The approved set uses original X, Discord, Signal, LinkedIn [in] and Instagram glyph assets. Their aspect ratios and LinkedIn registered mark are preserved; current brand rules govern use. The generic Tabler link and Hugeicons GitHub paths use a reviewed 1.5px stroke. All seven marks fit a common 29px longest painted span in 62px controls, with visible labels, keyboard focus and selected states. MIT notices are retained in `licenses/`. Signal links cannot be generated from usernames; visitors paste their unique Signal share URL. Discord input accepts a numeric-ID profile URL, not a username.
