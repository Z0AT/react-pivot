# OpenClaw / Great Sage

## Role

Assistant and automation runtime hosted in the homelab.

## Current Placement

- Runs on dedicated server-side infrastructure in the lab
- Connected into the broader messaging and automation environment

## Notes

- GitHub and homelab SSH access were established locally during the current sweep
- Matrix integration is working in the chosen canonical encrypted room, but some Matrix account write operations remain affected by the known 403/1010 issue
- OpenClaw-adjacent infrastructure should continue following the same service-hardening patterns used elsewhere in the lab

## Recommendations

- Continue keeping secrets out of unit files and shell histories
- Preserve infrastructure notes and recovery guidance outside the running environment
- Treat messaging-path oddities as operational issues to document, not mysteries to forget
