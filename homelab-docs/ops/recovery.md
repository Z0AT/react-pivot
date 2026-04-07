# Recovery Notes

## Priority Order for Recovery

1. Hypervisor awareness and storage status
2. Core control-plane services
3. Messaging/automation services
4. Utility workloads
5. Nice-to-have rebuilds

## Practical Priorities

Likely early recovery priorities:
- Proxmox host sanity
- Network console / core routing awareness
- Home Assistant
- OpenClaw / assistant runtime
- Matrix
- Supporting service containers

## General Guidance

- Use documentation first, improvisation second
- Recover roles and connectivity before polishing secondary services
- Prefer a small number of confirmed-good services over many half-working ones
- Preserve notes on what is intentionally single-homed, dual-homed, tunnel-only, or locally scoped

## Restore Discipline

Backups that have never been restored are only partly trustworthy.

Recommended practice:
- periodically test restoring an LXC backup
- periodically test restoring a VM backup
- document the surprises so future recovery is less theatrical
