# React Pivot Staging Notes

## Goal

Stage the React pivot beside the existing `/dc-next/` Svelte preview without replacing it.

## Recommended shape

- Build `react-pivot/` as a Vite static app
- Sync `dist/` to a separate host directory such as `/opt/desire-cache-react-pivot/`
- Expose via nginx on a distinct path, for example `/dc-react/`
- Keep API pointed at `http://127.0.0.1:5000` on the host side

## Guardrail

Do not overwrite `/dc-next/` or `/` during this stage.
