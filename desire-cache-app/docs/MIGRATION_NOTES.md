# Desire Cache Migration Notes

## Scaffold state

- Date: 2026-04-08
- Agent note: Geld scaffolded this app as a separate SvelteKit frontend.
- Live service files in the workspace root were not modified as part of this scaffold.
- The canonical backend contract remains `/api/items`.

## What exists now

- SvelteKit + TypeScript app scaffold in `desire-cache-app/`
- Typed `DesireCacheItem` and `DesireCachePayload` model
- Configurable backend base URL via `PUBLIC_DESIRE_CACHE_API_BASE_URL`
- Server-side load path for canonical item hydration
- Tree Mode rendering with section and subsection grouping
- Minimal controls: section filter and search query
- Dossier modal for item inspection
- Staging shell showing API origin, sync time, counts, and section inventory
- Staged deployment running on the desire-cache host at `/dc-next/`
- Tree Mode prototype shifted toward clustered graph neighborhoods with subsection hubs, connector spines, and unlockable-style item nodes
- Interaction model now allows multiple open section neighborhoods by default, with one focused section for emphasis and per-section subsection selection
- Current interaction affordance pass adds an explicit guide, open-section quick-jump chips, separate hub focus vs open/close controls, stronger open/focused/revealed labels, and better hover/focus-visible feedback
- SSR fallback state now matches hydrated interaction state so initially rendered hub toggle labels do not lie about which neighborhoods are open
- Current traversal pass moves Tree Mode closer to a graph navigator: a pannable/zoomable viewport now hosts a generated spatial layout where the focused section sits at the center and other open neighborhoods orbit around it
- Non-focused neighborhoods now remain visible as compact branch nodes while the focused neighborhood expands the full reveal cluster, reducing the feeling of a stacked list while preserving the existing open/focus model
- Operability reset applied on 2026-04-09: completeness now takes precedence over graph cleverness
- Tree Mode was simplified so the board uses native scrolling instead of drag-only traversal, open section chips jump between neighborhoods, and each open neighborhood keeps all of its subsection clusters visible rather than hiding most items behind a single active branch
- Item cards are now explicitly image-backed in the grid: every card renders either the live item image or a visible fallback tile if the image fails to load
- Validation against the staged HTML confirmed `67` rendered item-card visuals, matching the `67` items in the canonical payload
- Node-first graph pass applied afterward: items now render as compact tokens inside branch lanes, with a detail dock handling expansion instead of full item cards dominating the layout
- Presentation taxonomy is no longer a raw echo of the sheet section names. The UI now maps sections to themed sector identities such as `Perk Injector`, `Comfort Daemon`, `Shell Mods`, and `Rig Matrix`, while branch grouping derives from subsection labels unless those labels are weak, in which case source/vendor labeling takes over
- Validation against the public staged HTML confirmed `67` rendered node tokens, matching the `67` items in the canonical payload
- Composition/flow refinement followed: section placement is now less obviously orbital, branch lanes curve and fan with more offset, tokens use staggered motion/placement, and the neighborhood shells themselves were softened away from rigid rectangles
- The goal of that pass was not to change the model again, but to reduce the remaining board stiffness while preserving the node-first graph foundation and operable navigation model
- A stronger free-space correction followed: visible neighborhood box logic was reduced further, branch space and detail space now share a looser field instead of reading as separate contained panels, and section backgrounds were softened into glows/halos rather than obvious cards
- Validation after the freer-space pass still showed `67` rendered node tokens in the public staged HTML, so the composition loosened without dropping item reachability

## Live feed validation

- Validated on 2026-04-08 from the local workspace:
  - `http://10.135.30.250/api/health` returned HTTP 200 through nginx
  - `http://10.135.30.250/api/items` returned a canonical payload with `totalItems: 67`
- Validated directly on the Desire Cache host over SSH:
  - backend service responds on `http://127.0.0.1:5000/api/health`
  - backend service responds on `http://127.0.0.1:5000/api/items`
  - nginx serves the current frontend from `http://127.0.0.1/`

## What is intentionally deferred

- Map Mode
- richer filtering and sorting controls
- image thumbnails and preview states
- write/admin flows
- production cutover
- deeper graph dynamics such as true node-edge layout and pan/zoom behavior
- richer multi-neighborhood navigation polish and explicit focus-mode affordances

## Deployment assumptions

- The current backend service continues to run independently and expose `/api/items`
- Initial deployment now exists on a separate path near the existing service: `/dc-next/`
- Reverse proxy cutover should happen only after parity checks against the live feed
- Runtime target has been validated on the current desire-cache server with `@sveltejs/adapter-node`

## Migration seam

- Backend preserved
- Frontend replaced incrementally
- `/api/items` remains the contract boundary until a later deliberate backend consolidation step
