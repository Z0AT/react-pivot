# Network Architecture

## Core Console

- UniFi Dream Machine SE
- Network application active and functioning as primary network control plane

## VLANs / Networks

- Management, VLAN 1
- Hale_Server_Devices, VLAN 30
- Hale_Devices, VLAN 50
- Hale_IoT, VLAN 70

## Design Intent

- Server and infrastructure workloads live primarily on VLAN 30
- IoT devices live primarily on VLAN 70
- General/other device placement uses VLAN 50 as appropriate
- Management remains distinct

## Confirmed Infra Placement

Observed in UniFi and hypervisor review:

- PVE host on server network
- Great Sage / OpenClaw host on server network
- Matrix host on server network
- desire-cache on server network
- cloudflared utility host on server network
- DISbot on server network
- Home Assistant active on VLAN 70 / IoT network

## Home Assistant Network Position

Home Assistant is intentionally present on the IoT layer to reduce discovery and local-control friction with IoT devices.

This is a deliberate design choice, not an accident.

Preferred policy shape:

- trusted/admin networks can reach Home Assistant intentionally
- Home Assistant can reach IoT devices as needed
- IoT devices should not have broad return-path access into server infrastructure

## Notes

- Earlier design experimentation included more complex connectivity ideas, but the current preferred model is simpler: keep Home Assistant inherently adjacent to IoT rather than relying on fragile bridging tricks.
- Network policy matters more than decorative extra interfaces.
