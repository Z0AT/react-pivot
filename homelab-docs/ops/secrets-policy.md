# Secrets Policy

## Rule Zero

Do not store live secrets in this repository.

That includes:
- passwords
- API keys
- tunnel tokens
- long-lived bearer tokens
- SSH private keys
- session cookies

## Operational Lessons

- Secrets copied through awkward consoles are easy to fat-finger
- Prefix matching is not proof of correctness
- Verify exact values when authentication behaves inconsistently
- Prefer root-only env files or dedicated secret storage over embedding secrets in systemd unit files

## Current Practice Direction

- Keep service secrets out of unit `ExecStart` lines where possible
- Use root-only env files for local services when appropriate
- Treat credentials pasted into chat as spent and rotate them afterward
- Prefer supported API access paths before enabling lower-level shell access on appliances
