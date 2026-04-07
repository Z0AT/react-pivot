# Home Assistant

## Role

Primary home automation platform.

## Current Model

- Runs as VM `101` on Proxmox
- Deliberately positioned on the IoT layer for device adjacency and easier local discovery/control
- Backup coverage exists at the Proxmox layer

## USB Passthrough Notes

Observed design intent:
- Silicon Labs CP2105 Dual UART Bridge is used for Z-Wave
- Intel Bluetooth is intended for future Bluetooth-capable device support
- Bluetooth is useful as an adjunct capability, not the architectural foundation

## Network Notes

- Home Assistant is actively visible on VLAN 70 / IoT network
- Earlier configuration suggested a multi-interface model, but current observed active presence is the IoT-side NIC
- This is acceptable if trusted/admin paths are intentionally allowed and IoT-to-server return paths remain constrained

## Recommendations

- Preserve explicit documentation of USB device purpose
- Keep Bluetooth available for future BLE/presence/device integrations
- Prefer simple policy-based reachability over unnecessary multi-NIC complexity
- Periodically validate that Home Assistant backups and Proxmox VM backups remain recoverable
