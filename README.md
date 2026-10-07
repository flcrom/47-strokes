# 47 strokes

One line in. One line out.

A monochrome drawing project with 47 retained marks. Draw anywhere on a 960 × 480 logical canvas with one continuous gesture. Each stroke can use up to 2,880 logical pixels of path distance. The newest enters in black; older marks lighten by relative age, and the oldest leaves when a new mark arrives. A five-minute cooldown follows submission.

Optional links use a manual HTTPS field by default, or icon choices for GitHub, X, LinkedIn and Monkeytype usernames. Desktop hover and the Inspect links mode reveal a mark's URL. The live counter measures path length, not filled area.

Three original isometric SVG motion studies use pointer-responsive, bounded springs. They stop at rest, offscreen or when the tab is hidden. Reduced motion holds the resting pose.

## Current state

This is the private prototype source. State exists only in the open session; reloading resets it. There is no shared backend, global lock, production persistence or moderation service. No public site or GitHub profile embedding is deployed.

The current UI uses a private page component package. This snapshot is not yet a standalone npm application: a production React shell, dependencies and build configuration need to be added before independent deployment. The drawing and link modules are dependency-free ES modules.

## Tests

Run `node --test core.test.mjs` for geometry, exact path retention, perimeter clipping, 47 shades and cooldown checks.

## Motion inspiration

Hairline by Lucas Marques: https://hairline.lucasmarkes.com/
Original reference: https://x.com/lucasmarkes__/status/2105386342540579198
The motion studies here are original geometry. No Hairline source code is bundled.
