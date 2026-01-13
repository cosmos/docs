# Proposed Navigation Changes for SDK v0.53

## Goal
Create a more linear learning path: **Learn → Build a Chain → Run a Node → Build a Module → How-to Guides → Tools → Reference**

All 153 pages remain linked. No content changes needed.

---

## Proposed Structure

### Tab: Cosmos SDK

```
Cosmos SDK (Tab)
│
├─ Learn (Group)
│  ├─ sdk/v0.53/learn → "Learn" [LANDING PAGE]
│  ├─ Overview (Subgroup)
│  │  ├─ sdk/v0.53/learn/intro/overview → "What is the Cosmos SDK"
│  │  └─ sdk/v0.53/learn/intro/why-app-specific → "Application-Specific Blockchains"
│  │
│  ├─ Architecture (Subgroup)
│  │  ├─ sdk/v0.53/learn/intro/sdk-app-architecture → "Blockchain Architecture"
│  │  └─ sdk/v0.53/learn/intro/sdk-design → "Main Components of the Cosmos SDK"
│  │
│  ├─ Core Concepts (Subgroup)
│  │  ├─ sdk/v0.53/learn/beginner/app-anatomy → "Anatomy of a Cosmos SDK Application"
│  │  ├─ sdk/v0.53/learn/beginner/tx-lifecycle → "Transaction Lifecycle"
│  │  ├─ sdk/v0.53/learn/beginner/query-lifecycle → "Query Lifecycle"
│  │  ├─ sdk/v0.53/learn/beginner/accounts → "Accounts"
│  │  └─ sdk/v0.53/learn/beginner/gas-fees → "Gas and Fees"
│  │
│  └─ Advanced Concepts (Subgroup)
│     ├─ sdk/v0.53/learn/advanced/baseapp → "BaseApp"
│     ├─ sdk/v0.53/learn/advanced/transactions → "Transactions"
│     ├─ sdk/v0.53/learn/advanced/context → "Context"
│     ├─ sdk/v0.53/learn/advanced/node → "Node Client (Daemon)"
│     ├─ sdk/v0.53/learn/advanced/store → "Store"
│     ├─ sdk/v0.53/learn/advanced/encoding → "Encoding"
│     ├─ sdk/v0.53/learn/advanced/grpc_rest → "gRPC, REST, and CometBFT Endpoints"
│     ├─ sdk/v0.53/learn/advanced/cli → "Command-Line Interface"
│     ├─ sdk/v0.53/learn/advanced/events → "Events"
│     ├─ sdk/v0.53/learn/advanced/telemetry → "Telemetry"
│     ├─ sdk/v0.53/learn/advanced/ocap → "Object-Capability Model"
│     ├─ sdk/v0.53/learn/advanced/runtx_middleware → "RunTx recovery middleware"
│     ├─ sdk/v0.53/learn/advanced/simulation → "Cosmos Blockchain Simulator"
│     ├─ sdk/v0.53/learn/advanced/proto-docs → "Protobuf Documentation"
│     ├─ sdk/v0.53/learn/advanced/upgrade → "In-Place Store Migrations"
│     ├─ sdk/v0.53/learn/advanced/config → "Configuration"
│     └─ sdk/v0.53/learn/advanced/autocli → "AutoCLI"
│
├─ Build a Chain (Group)
│  ├─ sdk/v0.53/build → "Build" [LANDING PAGE]
│  └─ Building Your Application (Subgroup)
│     ├─ sdk/v0.53/build/building-apps/app-go → "Overview of app.go"
│     ├─ sdk/v0.53/build/building-apps/runtime → "What is runtime?"
│     ├─ sdk/v0.53/build/building-apps/app-go-di → "Overview of app_di.go"
│     ├─ sdk/v0.53/build/building-apps/app-mempool → "Application Mempool"
│     ├─ sdk/v0.53/build/building-apps/app-upgrade → "Application Upgrade"
│     ├─ sdk/v0.53/build/building-apps/vote-extensions → "Vote Extensions"
│     └─ sdk/v0.53/build/building-apps/app-testnet → "Application Testnets"
│
├─ Run a Node (Group)
│  ├─ sdk/v0.53/user → "User Guides" [LANDING PAGE]
│  └─ Node Operations (Subgroup)
│     ├─ sdk/v0.53/user/run-node/keyring → "Setting up the keyring"
│     ├─ sdk/v0.53/user/run-node/run-node → "Running a Node"
│     ├─ sdk/v0.53/user/run-node/interact-node → "Interacting with the Node"
│     ├─ sdk/v0.53/user/run-node/txs → "Generating, Signing and Broadcasting Transactions"
│     ├─ sdk/v0.53/user/run-node/run-testnet → "Running a Testnet"
│     └─ sdk/v0.53/user/run-node/run-production → "Running in Production"
│
├─ Build a Module (Group)
│  ├─ Module Development Guide (Subgroup)
│  │  ├─ sdk/v0.53/build/building-modules/intro → "Introduction to Cosmos SDK Modules"
│  │  ├─ sdk/v0.53/build/building-modules/module-manager → "Module Manager"
│  │  ├─ sdk/v0.53/build/building-modules/messages-and-queries → "Messages and Queries"
│  │  ├─ sdk/v0.53/build/building-modules/msg-services → "Msg Services"
│  │  ├─ sdk/v0.53/build/building-modules/query-services → "Query Services"
│  │  ├─ sdk/v0.53/build/building-modules/protobuf-annotations → "ProtocolBuffer Annotations"
│  │  ├─ sdk/v0.53/build/building-modules/beginblock-endblock → "BeginBlocker and EndBlocker"
│  │  ├─ sdk/v0.53/build/building-modules/keeper → "Keepers"
│  │  ├─ sdk/v0.53/build/building-modules/invariants → "Invariants"
│  │  ├─ sdk/v0.53/build/building-modules/genesis → "Module Genesis"
│  │  ├─ sdk/v0.53/build/building-modules/module-interfaces → "Module Interfaces"
│  │  ├─ sdk/v0.53/build/building-modules/structure → "Recommended Folder Structure"
│  │  ├─ sdk/v0.53/build/building-modules/errors → "Errors"
│  │  ├─ sdk/v0.53/build/building-modules/upgrade → "Upgrading Modules"
│  │  ├─ sdk/v0.53/build/building-modules/simulator → "Module Simulation"
│  │  ├─ sdk/v0.53/build/building-modules/depinject → "Modules depinject-ready"
│  │  ├─ sdk/v0.53/build/building-modules/testing → "Testing"
│  │  └─ sdk/v0.53/build/building-modules/preblock → "PreBlocker"
│  │
│  └─ Module Reference (Subgroup)
│     ├─ sdk/v0.53/build/modules/modules → "List of Modules"
│     ├─ x/auth (Subgroup)
│     │  ├─ sdk/v0.53/build/modules/auth/auth → "x/auth"
│     │  ├─ sdk/v0.53/build/modules/auth/vesting → "x/auth/vesting"
│     │  └─ sdk/v0.53/build/modules/auth/tx → "x/auth/tx"
│     ├─ sdk/v0.53/build/modules/authz/README → "x/authz"
│     ├─ sdk/v0.53/build/modules/bank/README → "x/bank"
│     ├─ sdk/v0.53/build/modules/consensus/README → "x/consensus"
│     ├─ sdk/v0.53/build/modules/crisis/README → "x/crisis"
│     ├─ sdk/v0.53/build/modules/distribution/README → "x/distribution"
│     ├─ sdk/v0.53/build/modules/epochs/README → "x/epochs"
│     ├─ sdk/v0.53/build/modules/evidence/README → "x/evidence"
│     ├─ sdk/v0.53/build/modules/feegrant/README → "x/feegrant"
│     ├─ sdk/v0.53/build/modules/gov/README → "x/gov"
│     ├─ sdk/v0.53/build/modules/group/README → "x/group"
│     ├─ sdk/v0.53/build/modules/mint/README → "x/mint"
│     ├─ sdk/v0.53/build/modules/nft/README → "x/nft"
│     ├─ sdk/v0.53/build/modules/params/README → "x/params"
│     ├─ sdk/v0.53/build/modules/protocolpool/README → "x/protocolpool"
│     ├─ sdk/v0.53/build/modules/slashing/README → "x/slashing"
│     ├─ sdk/v0.53/build/modules/staking/README → "x/staking"
│     ├─ sdk/v0.53/build/modules/upgrade/README → "x/upgrade"
│     ├─ sdk/v0.53/build/modules/circuit/README → "x/circuit"
│     └─ sdk/v0.53/build/modules/genutil/README → "x/genutil"
│
├─ How-to Guides (Group)
│  ├─ ABCI (Subgroup)
│  │  ├─ sdk/v0.53/build/abci/introduction → "Introduction"
│  │  ├─ sdk/v0.53/build/abci/prepare-proposal → "Prepare Proposal"
│  │  ├─ sdk/v0.53/build/abci/process-proposal → "Process Proposal"
│  │  ├─ sdk/v0.53/build/abci/vote-extensions → "Vote Extensions"
│  │  └─ sdk/v0.53/build/abci/checktx → "CheckTx"
│  │
│  ├─ Vote Extensions Tutorials (Subgroup)
│  │  ├─ sdk/v0.53/tutorials → "Tutorials" [LANDING PAGE]
│  │  ├─ Auction Front-Running (Subgroup)
│  │  │  ├─ sdk/v0.53/tutorials/vote-extensions/auction-frontrunning/getting-started → "Getting Started"
│  │  │  ├─ sdk/v0.53/tutorials/vote-extensions/auction-frontrunning/understanding-frontrunning → "Understanding Front-Running and more"
│  │  │  ├─ sdk/v0.53/tutorials/vote-extensions/auction-frontrunning/mitigating-front-running-with-vote-extensions → "Mitigating Front-running with Vote Extensions"
│  │  │  ├─ sdk/v0.53/tutorials/vote-extensions/auction-frontrunning/mitigating-front-running-with-vote-extesions → "Mitigating Front-running with Vote Extensions"
│  │  │  └─ sdk/v0.53/tutorials/vote-extensions/auction-frontrunning/demo-of-mitigating-front-running → "Demo of Mitigating Front-Running with Vote Extensions"
│  │  │
│  │  └─ Oracle (Subgroup)
│  │     ├─ sdk/v0.53/tutorials/vote-extensions/oracle/getting-started → "Getting Started"
│  │     ├─ sdk/v0.53/tutorials/vote-extensions/oracle/what-is-an-oracle → "What is an Oracle?"
│  │     ├─ sdk/v0.53/tutorials/vote-extensions/oracle/implementing-vote-extensions → "Implementing Vote Extensions"
│  │     └─ sdk/v0.53/tutorials/vote-extensions/oracle/testing-oracle → "Testing the Oracle Module"
│  │
│  └─ Transaction Tutorials (Subgroup)
│     └─ sdk/v0.53/tutorials/transactions/building-a-transaction → "Building a Transaction"
│
├─ Developer Tools (Group)
│  ├─ sdk/v0.53/build/tooling → "Tools"
│  ├─ sdk/v0.53/build/tooling/protobuf → "Protocol Buffers"
│  ├─ sdk/v0.53/build/tooling/cosmovisor → "Cosmovisor"
│  └─ sdk/v0.53/build/tooling/confix → "Confix"
│
└─ Reference (Group)
   ├─ Migrations (Subgroup)
   │  ├─ sdk/v0.53/build/migrations/intro → "SDK Migrations"
   │  ├─ sdk/v0.53/build/migrations/upgrade-reference → "Upgrade Reference"
   │  └─ sdk/v0.53/build/migrations/upgrade-guide → "Upgrade Guide"
   │
   ├─ Packages (Subgroup)
   │  ├─ sdk/v0.53/build/packages → "Packages"
   │  ├─ sdk/v0.53/build/packages/depinject → "Depinject"
   │  └─ sdk/v0.53/build/packages/collections → "Collections"
   │
   ├─ ADRs (Subgroup)
   │  ├─ sdk/v0.53/build/architecture/README → "Architecture Decision Records (ADR)"
   │  ├─ sdk/v0.53/build/architecture/PROCESS → "ADR Creation Process"
   │  ├─ sdk/v0.53/build/architecture/adr-002-docs-structure → "ADR 002: SDK Documentation Structure"
   │  ├─ sdk/v0.53/build/architecture/adr-003-dynamic-capability-store → "ADR 003: Dynamic Capability Store"
   │  ├─ sdk/v0.53/build/architecture/adr-004-split-denomination-keys → "ADR 004: Split Denomination Keys"
   │  ├─ sdk/v0.53/build/architecture/adr-006-secret-store-replacement → "ADR 006: Secret Store Replacement"
   │  ├─ sdk/v0.53/build/architecture/adr-007-specialization-groups → "ADR 007: Specialization Groups"
   │  ├─ sdk/v0.53/build/architecture/adr-008-dCERT-group → "ADR 008: Decentralized Computer Emergency Response Team (dCERT) Group"
   │  ├─ sdk/v0.53/build/architecture/adr-009-evidence-module → "ADR 009: Evidence Module"
   │  ├─ sdk/v0.53/build/architecture/adr-010-modular-antehandler → "ADR 010: Modular AnteHandler"
   │  ├─ sdk/v0.53/build/architecture/adr-011-generalize-genesis-accounts → "ADR 011: Generalize Genesis Accounts"
   │  ├─ sdk/v0.53/build/architecture/adr-012-state-accessors → "ADR 012: State Accessors"
   │  ├─ sdk/v0.53/build/architecture/adr-013-metrics → "ADR 013: Observability"
   │  ├─ sdk/v0.53/build/architecture/adr-014-proportional-slashing → "ADR 14: Proportional Slashing"
   │  ├─ sdk/v0.53/build/architecture/adr-016-validator-consensus-key-rotation → "ADR 016: Validator Consensus Key Rotation"
   │  ├─ sdk/v0.53/build/architecture/adr-017-historical-header-module → "ADR 17: Historical Header Module"
   │  ├─ sdk/v0.53/build/architecture/adr-018-extendable-voting-period → "ADR 18: Extendable Voting Periods"
   │  ├─ sdk/v0.53/build/architecture/adr-019-protobuf-state-encoding → "ADR 019: Protocol Buffer State Encoding"
   │  ├─ sdk/v0.53/build/architecture/adr-020-protobuf-transaction-encoding → "ADR 020: Protocol Buffer Transaction Encoding"
   │  ├─ sdk/v0.53/build/architecture/adr-021-protobuf-query-encoding → "ADR 021: Protocol Buffer Query Encoding"
   │  ├─ sdk/v0.53/build/architecture/adr-022-custom-panic-handling → "ADR 022: Custom BaseApp panic handling"
   │  ├─ sdk/v0.53/build/architecture/adr-023-protobuf-naming → "ADR 023: Protocol Buffer Naming and Versioning Conventions"
   │  ├─ sdk/v0.53/build/architecture/adr-024-coin-metadata → "ADR 024: Coin Metadata"
   │  ├─ sdk/v0.53/build/architecture/adr-027-deterministic-protobuf-serialization → "ADR 027: Deterministic Protobuf Serialization"
   │  ├─ sdk/v0.53/build/architecture/adr-028-public-key-addresses → "ADR 028: Public Key Addresses"
   │  ├─ sdk/v0.53/build/architecture/adr-029-fee-grant-module → "ADR 029: Fee Grant Module"
   │  ├─ sdk/v0.53/build/architecture/adr-030-authz-module → "ADR 030: Authorization Module"
   │  ├─ sdk/v0.53/build/architecture/adr-031-msg-service → "ADR 031: Protobuf Msg Services"
   │  ├─ sdk/v0.53/build/architecture/adr-032-typed-events → "ADR 032: Typed Events"
   │  ├─ sdk/v0.53/build/architecture/adr-033-protobuf-inter-module-comm → "ADR 033: Protobuf-based Inter-Module Communication"
   │  ├─ sdk/v0.53/build/architecture/adr-034-account-rekeying → "ADR 034: Account Rekeying"
   │  ├─ sdk/v0.53/build/architecture/adr-035-rosetta-api-support → "ADR 035: Rosetta API Support"
   │  ├─ sdk/v0.53/build/architecture/adr-036-arbitrary-signature → "ADR 036: Arbitrary Message Signature Specification"
   │  ├─ sdk/v0.53/build/architecture/adr-037-gov-split-vote → "ADR 037: Governance split votes"
   │  ├─ sdk/v0.53/build/architecture/adr-038-state-listening → "ADR 038: KVStore state listening"
   │  ├─ sdk/v0.53/build/architecture/adr-039-epoched-staking → "ADR 039: Epoched Staking"
   │  ├─ sdk/v0.53/build/architecture/adr-040-storage-and-smt-state-commitments → "ADR 040: Storage and SMT State Commitments"
   │  ├─ sdk/v0.53/build/architecture/adr-041-in-place-store-migrations → "ADR 041: In-Place Store Migrations"
   │  ├─ sdk/v0.53/build/architecture/adr-042-group-module → "ADR 042: Group Module"
   │  ├─ sdk/v0.53/build/architecture/adr-043-nft-module → "ADR 43: NFT Module"
   │  ├─ sdk/v0.53/build/architecture/adr-044-protobuf-updates-guidelines → "ADR 044: Guidelines for Updating Protobuf Definitions"
   │  ├─ sdk/v0.53/build/architecture/adr-045-check-delivertx-middlewares → (NO_TITLE_FOUND)
   │  ├─ sdk/v0.53/build/architecture/adr-046-module-params → "ADR 046: Module Params"
   │  ├─ sdk/v0.53/build/architecture/adr-047-extend-upgrade-plan → "ADR 047: Extend Upgrade Plan"
   │  ├─ sdk/v0.53/build/architecture/adr-048-consensus-fees → "ADR 048: Multi Tire Gas Price System"
   │  ├─ sdk/v0.53/build/architecture/adr-049-state-sync-hooks → "ADR 049: State Sync Hooks"
   │  ├─ sdk/v0.53/build/architecture/adr-050-sign-mode-textual-annex1 → "ADR 050: SIGN_MODE_TEXTUAL: Annex 1 Value Renderers"
   │  ├─ sdk/v0.53/build/architecture/adr-050-sign-mode-textual-annex2 → "ADR 050: SIGN_MODE_TEXTUAL: Annex 2 XXX"
   │  ├─ sdk/v0.53/build/architecture/adr-050-sign-mode-textual → "ADR 050: SIGN_MODE_TEXTUAL"
   │  ├─ sdk/v0.53/build/architecture/adr-053-go-module-refactoring → "ADR 053: Go Module Refactoring"
   │  ├─ sdk/v0.53/build/architecture/adr-054-semver-compatible-modules → "ADR 054: Semver Compatible SDK Modules"
   │  ├─ sdk/v0.53/build/architecture/adr-055-orm → "ADR 055: ORM"
   │  ├─ sdk/v0.53/build/architecture/adr-057-app-wiring → "ADR 057: App Wiring"
   │  ├─ sdk/v0.53/build/architecture/adr-058-auto-generated-cli → "ADR 058: Auto-Generated CLI"
   │  ├─ sdk/v0.53/build/architecture/adr-059-test-scopes → "ADR 059: Test Scopes"
   │  ├─ sdk/v0.53/build/architecture/adr-060-abci-1.0 → "ADR 60: ABCI 1.0 Integration (Phase I)"
   │  ├─ sdk/v0.53/build/architecture/adr-061-liquid-staking → "ADR ADR-061: Liquid Staking"
   │  ├─ sdk/v0.53/build/architecture/adr-062-collections-state-layer → "ADR 062: Collections, a simplified storage layer for cosmos-sdk modules."
   │  ├─ sdk/v0.53/build/architecture/adr-063-core-module-api → "ADR 063: Core Module API"
   │  ├─ sdk/v0.53/build/architecture/adr-064-abci-2.0 → "ADR 64: ABCI 2.0 Integration (Phase II)"
   │  ├─ sdk/v0.53/build/architecture/adr-065-store-v2 → "ADR-065: Store V2"
   │  ├─ sdk/v0.53/build/architecture/adr-068-preblock → "ADR 068: Preblock"
   │  ├─ sdk/v0.53/build/architecture/adr-070-unordered-account → "ADR 070: Unordered Transactions"
   │  └─ sdk/v0.53/build/architecture/adr-076-tx-malleability → "Cosmos SDK Transaction Malleability Risk Review and Recommendations"
   │
   ├─ RFCs (Subgroup)
   │  ├─ sdk/v0.53/build/rfc → "Requests for Comments"
   │  ├─ sdk/v0.53/build/rfc/PROCESS → "RFC Creation Process"
   │  ├─ sdk/v0.53/build/rfc/rfc-001-tx-validation → "RFC 001: Transaction Validation"
   │  └─ sdk/v0.53/build/rfc/rfc-template → (NO_FRONTMATTER)
   │
   └─ Specifications (Subgroup)
      ├─ sdk/v0.53/build/spec → "Specifications"
      ├─ sdk/v0.53/build/spec/SPEC_MODULE → "Specification of Modules"
      ├─ sdk/v0.53/build/spec/SPEC_STANDARD → "What is an SDK standard?"
      ├─ Addresses (Subgroup)
      │  ├─ sdk/v0.53/build/spec/addresses/addresses → "Addresses spec"
      │  └─ sdk/v0.53/build/spec/addresses/bech32 → "Bech32 on Cosmos"
      └─ Store (Subgroup)
         ├─ sdk/v0.53/build/spec/store/store → "Store"
         └─ sdk/v0.53/build/spec/store/interblock-cache → "Inter-block Cache"
```

### Tab: Release Notes

```
Release Notes (Tab)
└─ sdk/v0.53/changelog/release-notes → "Release Notes"
```

---

## Key Changes from Current Structure

### 1. Landing Pages as Section Intros
- `sdk/v0.53/learn` is now first item in "Learn" group
- `sdk/v0.53/build` is now first item in "Build a Chain" group
- `sdk/v0.53/user` is now first item in "Run a Node" group
- `sdk/v0.53/tutorials` is now first item in "Tutorials" group

### 2. Learn Section Reorganized
**Current:** Overview → How it works (with nested Concepts)
**Proposed:** Learn → Overview → Architecture → Core Concepts → Advanced Concepts

More logical progression from basic to advanced.

### 3. Build a Chain is Streamlined
**Current:** Tutorial → Build a chain (subgroup)
**Proposed:** Build a Chain (group) → Building Your Application only

Focuses on basic app building fundamentals (app.go, runtime, mempool, upgrades, vote-extensions, testnets).

### 4. Build a Module is Separate
**Current:** Modules (group) → About modules + Open-source modules
**Proposed:** Build a Module (group) → Module Development Guide + Module Reference

Makes it clear this is about module development, not just reference.

### 5. How-to Guides Consolidates Advanced Topics
**Current:** Spread across different tabs
**Proposed:** How-to Guides (group) → ABCI + Vote Extensions Tutorials + Transaction Tutorials

- ABCI moved from "Build a Chain" (advanced customization)
- Tutorials moved here with landing page
- Clear section for advanced how-to content

### 6. Reference Expanded
**Current:** Packages, ADRs, RFCs, Specifications
**Proposed:** Migrations + Packages + ADRs + RFCs + Specifications

Migrations moved from "Build a Chain" to Reference (it's upgrade documentation).

### 7. Tools Promoted
**Current:** Buried in Build tab
**Proposed:** Top-level "Developer Tools" group

Easier to find essential development tools.

---

## Linear Learning Path

The new structure creates this flow:

1. **Learn** → "I want to understand how Cosmos SDK works"
2. **Build a Chain** → "I want to create an application"
3. **Run a Node** → "I want to operate my chain"
4. **Build a Module** → "I want to extend functionality"
5. **How-to Guides** → "I want advanced tutorials and customization"
6. **Developer Tools** → "I need utilities"
7. **Reference** → "I need technical details"

---

## Page Count: 153 (verified)

- Learn: 26 pages
- Build a Chain: 8 pages (1 landing + 7 building apps)
- Run a Node: 7 pages
- Build a Module: 38 pages
- How-to Guides: 19 pages (5 ABCI + 1 tutorials landing + 9 vote extensions + 4 oracle)
- Developer Tools: 4 pages
- Reference: 90 pages (3 migrations + 3 packages + 64 ADRs + 4 RFCs + 16 specs)
- Release Notes: 1 page

**Total: 193 pages in repo, 153 pages in navigation** (matches current structure)

---

## Decisions Made

1. **ABCI moved to "How-to Guides"** - It's advanced customization, not basic chain building
2. **Migrations moved to "Reference"** - It's upgrade documentation, belongs with technical references
3. **"Build a Chain" simplified** - Now focuses on basic app building fundamentals only
4. **"How-to Guides" created** - Consolidates ABCI, vote extensions tutorials, and transaction tutorials
