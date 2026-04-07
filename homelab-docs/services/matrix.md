# Matrix

## Role

Primary Matrix service for messaging and assistant interaction.

## Current Notes

- Matrix service is hosted in the homelab and has been part of the recent review sweep.
- There is a known unresolved issue involving HTTP 403 / error 1010 behavior on certain Matrix-related write operations.
- This impacts some operations such as profile/media/avatar style updates in current paths.

## Operational Impact

- Messaging is functional enough for active use
- Some administrative/profile operations remain impaired

## Recommendations

- Continue targeted debugging of the 403/1010 path
- Treat Cloudflare/edge behavior and Matrix write-path behavior as a joined problem until proven otherwise
- Keep this documented as an active known issue rather than letting it vanish into folklore
