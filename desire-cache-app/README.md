# Desire Cache App

SvelteKit + TypeScript staging frontend for Desire Cache.

This app is intentionally separate from the current live Desire Cache files in the workspace. It treats the existing backend data service as canonical and reads from `/api/items`.

## Current scope

- Preserve the current backend/data service
- Use `/api/items` as the canonical migration seam
- Rebuild the frontend cleanly in SvelteKit
- Implement Tree Mode first
- Leave current live service paths untouched until staging is validated

## Environment

Copy `.env.example` to `.env` and adjust if the backend is not same-origin:

```bash
PUBLIC_DESIRE_CACHE_API_BASE_URL=http://127.0.0.1:5000
DESIRE_CACHE_APP_BASE_PATH=
```

If the variable is left empty, the app will request `/api/items` from the same origin.

For staging on the Desire Cache host behind nginx under `/dc-next/`, use:

```bash
PUBLIC_DESIRE_CACHE_API_BASE_URL=http://127.0.0.1:5000
DESIRE_CACHE_APP_BASE_PATH=/dc-next
```

## Development

```bash
npm run dev
```

## First-pass structure

- `src/lib/types/desire-cache.ts`: typed item and payload model matching the canonical feed
- `src/lib/config.ts`: backend URL resolution helpers
- `src/routes/+page.server.ts`: server-side load from `/api/items`
- `src/routes/+page.svelte`: shell layout and staging dashboard
- `src/lib/components/TreeMode.svelte`: first Tree Mode rendering pass
- `docs/MIGRATION_NOTES.md`: implementation state and deployment assumptions
- `docs/DEPLOYMENT_STAGING.md`: staging plan and rollback path
