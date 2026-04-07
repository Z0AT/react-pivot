# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

### Home Lab Notes

- Home Assistant VM is `101` on `halepve`.
- HA USB passthrough:
  - `10c4:ea70` → Silicon Labs CP2105 Dual UART Bridge, used for Z-Wave.
  - `8087:0026` → Intel Bluetooth, intended for future Bluetooth-capable device support.
  - `303a:831a` → previous Wi-Fi-related path that did not become the preferred HA connectivity approach.
- HA network intent: keep HA inherently present on the IoT layer rather than depending on Wi-Fi bridging hacks, while retaining trusted/admin-side management access.
- UniFi access additions exist under `/secrets`, including a `unifi-token` for UniFi view/API use and a local-only SSH account/path `unifi-local` for home-network SSH capabilities.

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
