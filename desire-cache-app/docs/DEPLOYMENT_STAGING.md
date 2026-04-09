# Desire Cache Staging Deployment Steps

## Goal

Stage the new SvelteKit frontend near the existing Desire Cache service without changing the current live routes until replacement readiness is confirmed.

## Baseline assumptions

- Existing backend/data service continues to expose `/api/items`
- Existing live Desire Cache frontend remains in place
- New app is deployed separately first

## First staging path

Recommended initial shape:

1. Build `desire-cache-app` with `DESIRE_CACHE_APP_BASE_PATH=/dc-next`
2. Run it as a separate Node service on `127.0.0.1:4173`
3. Keep the current metadata backend on `127.0.0.1:5000`
4. Set `PUBLIC_DESIRE_CACHE_API_BASE_URL=http://127.0.0.1:5000` for the staged app service
5. Add an nginx `location /dc-next/` proxy block before the live `location /`
6. Reload nginx without changing the current live root config

Chosen safe staging target:

- `/dc-next/` on the existing desire-cache host
- Validation completed on 2026-04-08

## Validation checklist before cutover

- Tree Mode loads successfully from the live `/api/items` feed
- Section and subsection grouping matches current data expectations
- Item links open correctly
- Error state is understandable when the backend is unavailable
- Build and restart path is documented
- Rollback path is trivial

## Cutover guardrail

Do not replace the current live frontend path until:

- Tree Mode reaches acceptable parity
- staged app has been exercised against live data
- deployment target and adapter choice are confirmed
- rollback is tested

## Exact host-side deployment steps

1. Sync `desire-cache-app/` to `/opt/desire-cache-app/`
2. On host:
   - `cd /opt/desire-cache-app`
   - `npm ci`
   - `DESIRE_CACHE_APP_BASE_PATH=/dc-next PUBLIC_DESIRE_CACHE_API_BASE_URL=http://127.0.0.1:5000 npm run build`
3. Install a systemd unit for the staged app on port `4173`
4. Start the staged service and confirm `curl http://127.0.0.1:4173/dc-next/`
5. Add nginx `location /dc-next/ { proxy_pass http://127.0.0.1:4173; ... }`
6. `nginx -t && systemctl reload nginx`
7. Validate `http://10.135.30.250/dc-next/`

## Current deployed staging state

- Source synced to `/opt/desire-cache-app/`
- Runtime target: SvelteKit with `@sveltejs/adapter-node`
- Staging service: `desire-cache-app-staging.service`
- Staging bind: `127.0.0.1:4173`
- Staging preview path: `http://10.135.30.250/dc-next/`
- Backend used by staged app: `http://127.0.0.1:5000`
- Validation result:
  - `http://127.0.0.1:4173/dc-next/` returned the staged app with `67` objects
  - `http://10.135.30.250/dc-next/` returned the staged app with `67` objects
  - `http://10.135.30.250/` remained the current live frontend
  - `http://10.135.30.250/api/health` remained healthy

## Asset-path fix applied

- Root cause: nginx regex static-asset location `location ~* \.(css|js|...)$` was intercepting staged requests like `/dc-next/_app/immutable/assets/*.css` before they reached the proxied SvelteKit app.
- Symptom: staged HTML rendered, but CSS/JS asset URLs under `/dc-next/_app/` returned `404`, so the app appeared mostly unstyled/plain.
- Fix: changed the nginx staging block from `location /dc-next/` to `location ^~ /dc-next/` so nginx stops regex matching for the staging path and forwards all `/dc-next/*` requests to the Node app.
- Validation after fix:
  - `http://10.135.30.250/dc-next/_app/immutable/assets/0.JNm_RVT7.css` returned `200`
  - `http://10.135.30.250/dc-next/_app/immutable/entry/app.aastqE3O.js` returned `200`

## Rollback

- `systemctl stop desire-cache-app-staging`
- `systemctl disable desire-cache-app-staging`
- remove or comment the nginx `/dc-next/` block
- `nginx -t && systemctl reload nginx`
- optionally restore the latest `/etc/nginx/sites-available/desire-cache.bak-*`

This leaves the current live `/` site and `/api/` backend path untouched.
