# Host Inventory

## Hypervisor

### halepve

Primary Proxmox VE host.

Key observations:
- Proxmox VE 9.x host
- Primary virtualization and storage node for the lab
- Uses a mix of local-lvm and ZFS-backed `vm-storage`
- UniFi and PVE review work identified the need for explicit backup discipline and continued firewall sanity checks

## Important Guests

### VM 101 - Home Assistant
- Role: home automation control plane
- Runs as a VM, not LXC
- Uses USB passthrough for radio/device integration
- Actively present on IoT VLAN 70

### VM 1001 - OpenClaw
- Role: agent/runtime infrastructure
- Server VLAN placement

### VM 1010 - Matrix
- Role: Matrix service
- Server VLAN placement

### CT 444 - rd
- Role: remote/admin utility workload
- Hardened during current sweep

### CT 777 - desire-cache
- Role: metadata/static service
- Hardened during current sweep
- Service moved out of `/root`, runs as unprivileged user, Node backend bound to localhost only

### CT 999 - fileserver
- Role: Samba/fileserving workload
- Important note: primary data lives on a host bind mount, so container backup is not the whole backup story

### CT 1111 - cloudflared
- Role: utility tunnel/container workload
- Small and likely rebuildable

### CT 10101 - DISbot
- Role: bot/service workload
- Included in backup coverage

## Notes

- Architecture should be treated as role-driven, not merely VMID-driven.
- When rebuilding, prioritize control-plane and documentation-backed recovery over ad hoc host resurrection.
