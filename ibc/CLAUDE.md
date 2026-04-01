# CLAUDE.md — IBC Docs Section

This file provides guidance for working in the `ibc/` section of the IBC-docs Mintlify repo.

## Overview

This directory contains all IBC (Inter-Blockchain Communication) documentation for the docs site. It documents **ibc-go** — the canonical Go implementation of IBC — found at `../../../ibc-go/` (sibling repo).

Navigation for all versions is configured in the root `docs.json`.

## Protocol Context

Since ibc-go v10, two protocol versions coexist in the same release:

- **IBC Classic** — The original TAO (Transport, Authentication, Ordering) + APP layer architecture. Uses light clients, connections, channels, and ports.
- **IBC v2** — A newer, simplified protocol. Separate from Classic; a connection uses one or the other, not both.

For IBC Eureka (the canonical IBC v2 deployment connecting Cosmos chains and Ethereum), see `../skip-go/eureka/`.

## Versioned Structure

| Directory    | Status         |
|--------------|----------------|
| `next/`      | Active — work here |
| `v10.1.x/`   | Frozen         |
| `v8.5.x/`    | Frozen         |
| `v7.8.x/`    | Frozen         |
| `v6.3.x/`    | Frozen         |
| `v5.4.x/`    | Frozen         |
| `v4.6.x/`    | Frozen         |
| `v0.2.0/`    | Frozen         |

**Always work in `next/`.** Frozen versions should not be edited except to fix critical errors.

## `next/` Directory Structure

```
next/
├── index.mdx                   # Section landing page
├── intro.mdx                   # IBC-Go introduction and high-level overview
├── security-audits.mdx         # Security audit history
│
├── ibc/                        # Core IBC protocol (TAO layer)
│   ├── overview.mdx
│   ├── integration.mdx
│   ├── best-practices.mdx
│   ├── relayer.mdx
│   ├── permissioning.mdx
│   ├── apps/                   # Building IBC application modules
│   │   ├── apps.mdx
│   │   ├── address-codec.mdx
│   │   ├── bindports.mdx
│   │   ├── ibcmodule.mdx       # IBCModule interface
│   │   ├── ibcv2apps.mdx       # IBCv2 app development
│   │   ├── keeper.mdx
│   │   ├── packets_acks.mdx
│   │   └── routing.mdx
│   ├── middleware/             # Writing custom middleware
│   │   ├── overview.mdx
│   │   ├── develop.mdx
│   │   ├── developIBCv2.mdx
│   │   └── integration.mdx
│   └── upgrades/               # Chain upgrade handling
│       ├── intro.mdx
│       ├── quick-guide.mdx
│       ├── developer-guide.mdx
│       └── genesis-restart.mdx
│
├── apps/                       # IBC application modules (ICS standards)
│   ├── transfer/               # ICS-20 fungible token transfer
│   │   ├── overview.mdx
│   │   ├── state.mdx
│   │   ├── state-transitions.mdx
│   │   ├── messages.mdx
│   │   ├── events.mdx
│   │   ├── params.mdx
│   │   ├── client.mdx
│   │   ├── authorizations.mdx
│   │   └── IBCv2-transfer.mdx
│   └── interchain-accounts/    # ICS-27 Interchain Accounts (ICA)
│       ├── overview.mdx
│       ├── integration.mdx
│       ├── auth-modules.mdx
│       ├── messages.mdx
│       ├── tx-encoding.mdx
│       ├── parameters.mdx
│       ├── active-channels.mdx
│       ├── client.mdx
│       ├── development.mdx
│       └── legacy/             # Legacy ICA API (pre-v7)
│           ├── auth-modules.mdx
│           ├── integration.mdx
│           └── keeper-api.mdx
│
├── light-clients/              # Light client implementations
│   ├── proposals.mdx           # Governance proposals for light clients
│   ├── tendermint/
│   │   └── overview.mdx
│   ├── solomachine/
│   │   ├── concepts.mdx
│   │   ├── solomachine.mdx
│   │   ├── state.mdx
│   │   └── state_transitions.mdx
│   ├── localhost/
│   ├── wasm/                   # 08-wasm light client
│   │   ├── overview.mdx
│   │   ├── concepts.mdx
│   │   ├── contracts.mdx
│   │   ├── integration.mdx
│   │   ├── governance.mdx
│   │   ├── messages.mdx
│   │   ├── events.mdx
│   │   ├── client.mdx
│   │   └── migrations.mdx
│   └── developer-guide/        # Building custom light clients
│       ├── overview.mdx
│       ├── setup.mdx
│       ├── client-state.mdx
│       ├── consensus-state.mdx
│       ├── light-client-module.mdx
│       ├── proofs.mdx
│       ├── proposals.mdx
│       ├── updates-and-misbehaviour.mdx
│       └── upgrades.mdx
│
├── middleware/                 # Middleware modules
│   ├── callbacks/              # IBC Callbacks middleware
│   │   ├── overview.mdx
│   │   ├── integration.mdx
│   │   ├── interfaces.mdx
│   │   ├── end-users.mdx
│   │   ├── gas.mdx
│   │   ├── events.mdx
│   │   └── callbacks-IBCv2.mdx
│   ├── packet-forward-middleware/
│   │   ├── overview.mdx
│   │   ├── integration.mdx
│   │   └── example-usage.mdx
│   └── rate-limit-middleware/
│       ├── overview.mdx
│       ├── integration.mdx
│       └── setting-limits.mdx
│
├── migrations/                 # Version migration guides
│   ├── sdk-to-v1.mdx
│   ├── v1-to-v2.mdx
│   ├── v2-to-v3.mdx
│   ├── v3-to-v4.mdx
│   ├── v4-to-v5.mdx
│   ├── v5-to-v6.mdx
│   ├── v6-to-v7.mdx
│   ├── v7-to-v7_1.mdx
│   ├── v7-to-v8.mdx
│   ├── v7_2-to-v7_3.mdx
│   ├── v8-to-v8_1.mdx
│   ├── v8_1-to-v10.mdx
│   ├── v10-to-v11.mdx
│   ├── support-denoms-with-slashes.mdx
│   ├── support-stackbuilder.mdx
│   └── migration.template.mdx  # Template for new migration guides
│
└── changelog/
    └── release-notes.mdx       # Release notes (auto-synced from cosmos/ibc-go)
```

## Key Notes

- **Navigation**: All pages must be registered in the root `docs.json` to appear in the sidebar. Adding a new file without updating `docs.json` will make it unreachable.
- **IBCv2 content**: Many sections have parallel IBCv2 pages (e.g., `ibcv2apps.mdx`, `callbacks-IBCv2.mdx`, `IBCv2-transfer.mdx`). Keep Classic and v2 docs in sync when updating.
- **Legacy ICA**: The `apps/interchain-accounts/legacy/` subdirectory documents the pre-v7 ICA API. Do not update these files; they are frozen references.
- **Changelogs**: `changelog/release-notes.mdx` is managed by the versioning scripts in `../scripts/versioning/`. Don't edit it manually.
- **Images**: Shared images are in `../images/` (sibling to `next/`).
