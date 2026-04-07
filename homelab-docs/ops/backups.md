# Backups

## Current State

Recent work established actual Proxmox backup coverage and validated that backups run successfully.

## Proxmox Backup Job

A nightly Proxmox backup job exists for core workloads.

Characteristics:
- daily schedule
- snapshot mode
- zstd compression
- local storage target
- seven daily retention points

## Validated Backup Behavior

Successful manual test backups were run for:
- LXC workload `777` (desire-cache)
- VM workload `1010` (Matrix)

This confirms that both LXC and VM backup paths are functioning.

## Important Caveat

The fileserver container (`999`) uses a host bind mount for the primary data path. Proxmox backup of the container does not fully solve protection of the mounted data itself.

## Recommendations

- Maintain Proxmox nightly backups for control-plane and service workloads
- Add off-host backup strategy when convenient
- Treat bind-mounted fileserver data as a separate backup problem
- Periodically test restores, not just backup creation
