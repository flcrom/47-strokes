# Shared canvas preparation

The shared build uses one Cloudflare SQLite Durable Object for the latest 47 strokes and an atomic five-minute global cooldown. Geometry is validated on the server and kept exactly as submitted. All links must be public HTTPS URLs. They are not fetched or endorsed.

`npm ci`, `npm test`, `npm run build:shared`, `npm run dev:worker`.

Public writes are deliberately disabled in `wrangler.jsonc` until the abuse-protection setup is reviewed. Do not enable them for a public release without that check. Prototype reset and timer bypass controls are not present in the shared build.

GET `/api/canvas` returns the current 47 paths, version, server time and next allowed submission time. POST `/api/strokes` accepts one path and optional HTTPS link from the same origin. GET `/canvas.svg` returns an SVG image of the current artwork with no embedded external links. The README should use that image as a link to the drawing website after the confirmed domain is live. GitHub may cache remote images, so image freshness is not instant. The drawing page is the source of truth.

No account or deployment is changed by these files. Use the domain only after its deployment and returned image are verified.

The launch does not include private owner login or the removal page. Admin routes remain closed unless valid Access configuration is added later. Visitor report controls are absent and `/api/report` returns 404; this launch does not collect reports or promise owner review.
