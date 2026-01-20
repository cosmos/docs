# SDK v0.53 Navigation Structure (Mintlify)

This document outlines the navigation structure for the Cosmos SDK v0.53 documentation site, organized by tabs and groups as defined in the Mintlify configuration.

## Tab: Learn

### Cosmos SDK

* **Learn** (`sdk/v0.53/learn`) - Overview of the Learn section covering fundamentals, beginner topics, and advanced concepts of Cosmos SDK blockchain development.

  * **Introduction**
    * **Overview** (`sdk/v0.53/learn/intro/overview`) - High-level introduction to the Cosmos SDK, explaining what it is, application-specific blockchains, modularity, and why to use it.
    * **Why App-Specific** (`sdk/v0.53/learn/intro/why-app-specific`) - Explains the benefits and rationale behind building application-specific blockchains versus virtual-machine blockchains.
    * **SDK App Architecture** (`sdk/v0.53/learn/intro/sdk-app-architecture`) - Overview of the architecture of Cosmos SDK applications and how components fit together.
    * **SDK Design** (`sdk/v0.53/learn/intro/sdk-design`) - Core design principles and patterns used in the Cosmos SDK framework.

  * **Beginner**
    * **App Anatomy** (`sdk/v0.53/learn/beginner/app-anatomy`) - Detailed breakdown of the structure and components of a Cosmos SDK application.
    * **Transaction Lifecycle** (`sdk/v0.53/learn/beginner/tx-lifecycle`) - How transactions flow through a Cosmos SDK application from creation to execution.
    * **Query Lifecycle** (`sdk/v0.53/learn/beginner/query-lifecycle`) - How queries are processed and executed in Cosmos SDK applications.
    * **Accounts** (`sdk/v0.53/learn/beginner/accounts`) - Understanding account types, addresses, and account management in the Cosmos SDK.
    * **Gas and Fees** (`sdk/v0.53/learn/beginner/gas-fees`) - Explanation of gas calculation, fee structures, and fee payment mechanisms.

  * **Advanced**
    * **BaseApp** (`sdk/v0.53/learn/advanced/baseapp`) - Deep dive into BaseApp, the core application interface that handles ABCI messages and transaction routing.
    * **Transactions** (`sdk/v0.53/learn/advanced/transactions`) - Advanced topics on transaction structure, signing, encoding, and processing.
    * **Context** (`sdk/v0.53/learn/advanced/context`) - Understanding the Context object and how it manages state, authentication, and execution environment.
    * **Node Client (Daemon)** (`sdk/v0.53/learn/advanced/node`) - How to interact with and configure the node daemon that runs Cosmos SDK applications.
    * **Store** (`sdk/v0.53/learn/advanced/store`) - Advanced store concepts including IAVL trees, state management, and persistence.
    * **Encoding** (`sdk/v0.53/learn/advanced/encoding`) - Protocol buffer encoding, transaction encoding, and data serialization.
    * **gRPC & REST** (`sdk/v0.53/learn/advanced/grpc_rest`) - API endpoints for interacting with Cosmos SDK applications via gRPC and REST.
    * **CLI** (`sdk/v0.53/learn/advanced/cli`) - Command-line interface tools and commands for managing Cosmos SDK applications.
    * **Events** (`sdk/v0.53/learn/advanced/events`) - Event system for emitting and subscribing to application events.
    * **Telemetry** (`sdk/v0.53/learn/advanced/telemetry`) - Metrics, monitoring, and observability features for Cosmos SDK applications.
    * **Object-Capability Model** (`sdk/v0.53/learn/advanced/ocap`) - Security model based on object capabilities for safe module interactions.
    * **RunTx Recovery Middleware** (`sdk/v0.53/learn/advanced/runtx_middleware`) - Middleware for transaction execution recovery and error handling.
    * **Simulation** (`sdk/v0.53/learn/advanced/simulation`) - Cosmos Blockchain Simulator for testing and validating application behavior.
    * **Protobuf Documentation** (`sdk/v0.53/learn/advanced/proto-docs`) - Protocol buffer message definitions and documentation.
    * **Upgrade** (`sdk/v0.53/learn/advanced/upgrade`) - In-place store migrations and application upgrade mechanisms.
    * **Configuration** (`sdk/v0.53/learn/advanced/config`) - Application configuration options and settings.
    * **AutoCLI** (`sdk/v0.53/learn/advanced/autocli`) - Automatic CLI generation from protocol buffer service definitions.

---

## Tab: Build

### Cosmos SDK

* **Build** (`sdk/v0.53/build`) - Main build section covering app development, modules, migrations, packages, tooling, ADRs, and specifications.

  * **Building Apps**
    * **app.go** (`sdk/v0.53/build/building-apps/app-go`) - Overview of the main application file structure and setup.
    * **Runtime** (`sdk/v0.53/build/building-apps/runtime`) - Application runtime configuration and initialization.
    * **app.go with Dependency Injection** (`sdk/v0.53/build/building-apps/app-go-di`) - Building applications using dependency injection patterns.
    * **Mempool** (`sdk/v0.53/build/building-apps/app-mempool`) - Configuring and customizing transaction mempool behavior.
    * **App Upgrade** (`sdk/v0.53/build/building-apps/app-upgrade`) - Implementing application upgrades and migrations.
    * **Vote Extensions** (`sdk/v0.53/build/building-apps/vote-extensions`) - Using vote extensions to enhance consensus and block proposal.
    * **Testnet** (`sdk/v0.53/build/building-apps/app-testnet`) - Setting up and running applications on test networks.

  * **Building Modules**
    * **Introduction** (`sdk/v0.53/build/building-modules/intro`) - Getting started with building custom Cosmos SDK modules.
    * **Module Manager** (`sdk/v0.53/build/building-modules/module-manager`) - Organizing and managing multiple modules in an application.
    * **Messages and Queries** (`sdk/v0.53/build/building-modules/messages-and-queries`) - Defining and implementing module messages and queries.
    * **Message Services** (`sdk/v0.53/build/building-modules/msg-services`) - Protocol buffer message service implementation.
    * **Query Services** (`sdk/v0.53/build/building-modules/query-services`) - Protocol buffer query service implementation.
    * **Protobuf Annotations** (`sdk/v0.53/build/building-modules/protobuf-annotations`) - Using protobuf annotations for code generation and validation.
    * **BeginBlock & EndBlock** (`sdk/v0.53/build/building-modules/beginblock-endblock`) - Implementing block lifecycle hooks.
    * **Keeper** (`sdk/v0.53/build/building-modules/keeper`) - Creating and managing module keepers for state access.
    * **Invariants** (`sdk/v0.53/build/building-modules/invariants`) - Defining and checking module invariants for state validation.
    * **Genesis** (`sdk/v0.53/build/building-modules/genesis`) - Handling genesis state initialization for modules.
    * **Module Interfaces** (`sdk/v0.53/build/building-modules/module-interfaces`) - Implementing required module interfaces.
    * **Structure** (`sdk/v0.53/build/building-modules/structure`) - Recommended module directory structure and organization.
    * **Errors** (`sdk/v0.53/build/building-modules/errors`) - Error handling and custom error types in modules.
    * **Upgrade** (`sdk/v0.53/build/building-modules/upgrade`) - Module upgrade handlers and migration logic.
    * **Simulator** (`sdk/v0.53/build/building-modules/simulator`) - Testing modules with the blockchain simulator.
    * **Dependency Injection** (`sdk/v0.53/build/building-modules/depinject`) - Using dependency injection in module development.
    * **Testing** (`sdk/v0.53/build/building-modules/testing`) - Testing strategies and best practices for modules.
    * **PreBlock** (`sdk/v0.53/build/building-modules/preblock`) - Implementing PreBlock hooks for block processing.

  * **ABCI**
    * **Introduction** (`sdk/v0.53/build/abci/introduction`) - Overview of ABCI (Application Blockchain Interface) and its role connecting CometBFT to applications.
    * **PrepareProposal** (`sdk/v0.53/build/abci/prepare-proposal`) - Implementing PrepareProposal to customize block proposal creation.
    * **ProcessProposal** (`sdk/v0.53/build/abci/process-proposal`) - Implementing ProcessProposal to validate proposed blocks.
    * **Vote Extensions** (`sdk/v0.53/build/abci/vote-extensions`) - Using vote extensions in ABCI 2.0 for enhanced consensus.
    * **CheckTx** (`sdk/v0.53/build/abci/checktx`) - Implementing CheckTx for transaction validation in the mempool.

  * **Modules**
    * **Modules Overview** (`sdk/v0.53/build/modules/modules`) - Overview of all available Cosmos SDK modules.
    * **x/auth**
      * **Auth** (`sdk/v0.53/build/modules/auth/auth`) - Authentication and account management module.
      * **Vesting** (`sdk/v0.53/build/modules/auth/vesting`) - Token vesting functionality for accounts.
      * **Transaction** (`sdk/v0.53/build/modules/auth/tx`) - Transaction signing and authentication.
    * **x/authz** (`sdk/v0.53/build/modules/authz/README`) - Authorization module for granting permissions to other accounts.
    * **x/bank** (`sdk/v0.53/build/modules/bank/README`) - Bank module for token transfers and balances.
    * **x/consensus** (`sdk/v0.53/build/modules/consensus/README`) - Consensus parameter management module.
    * **x/crisis** (`sdk/v0.53/build/modules/crisis/README`) - Crisis module for detecting and handling invariant violations.
    * **x/distribution** (`sdk/v0.53/build/modules/distribution/README`) - Fee distribution and validator rewards module.
    * **x/epochs** (`sdk/v0.53/build/modules/epochs/README`) - Epoch management for time-based operations.
    * **x/evidence** (`sdk/v0.53/build/modules/evidence/README`) - Evidence handling for validator misbehavior.
    * **x/feegrant** (`sdk/v0.53/build/modules/feegrant/README`) - Fee grant module for allowing accounts to pay fees for others.
    * **x/gov** (`sdk/v0.53/build/modules/gov/README`) - Governance module for on-chain proposals and voting.
    * **x/group** (`sdk/v0.53/build/modules/group/README`) - Group module for multi-signature and group decision-making.
    * **x/mint** (`sdk/v0.53/build/modules/mint/README`) - Minting module for token inflation and supply management.
    * **x/nft** (`sdk/v0.53/build/modules/nft/README`) - Non-fungible token (NFT) module.
    * **x/params** (`sdk/v0.53/build/modules/params/README`) - Parameter management module for on-chain configuration.
    * **x/protocolpool** (`sdk/v0.53/build/modules/protocolpool/README`) - Protocol pool module for managing protocol-level funds.
    * **x/slashing** (`sdk/v0.53/build/modules/slashing/README`) - Slashing module for penalizing validator misbehavior.
    * **x/staking** (`sdk/v0.53/build/modules/staking/README`) - Staking module for validator management and delegation.
    * **x/upgrade** (`sdk/v0.53/build/modules/upgrade/README`) - Upgrade module for coordinating application upgrades.
    * **x/circuit** (`sdk/v0.53/build/modules/circuit/README`) - Circuit breaker module for emergency transaction halting.
    * **x/genutil** (`sdk/v0.53/build/modules/genutil/README`) - Genesis utility module for genesis transaction handling.

  * **Migrations**
    * **Introduction** (`sdk/v0.53/build/migrations/intro`) - Overview of migration processes between SDK versions.
    * **Upgrade Reference** (`sdk/v0.53/build/migrations/upgrade-reference`) - Reference guide for upgrade procedures and changes.
    * **Upgrade Guide** (`sdk/v0.53/build/migrations/upgrade-guide`) - Step-by-step guide for migrating applications between versions.

  * **Packages**
    * **Packages Overview** (`sdk/v0.53/build/packages`) - Overview of pre-built packages and utilities available in the SDK.
    * **Dependency Injection** (`sdk/v0.53/build/packages/depinject`) - Dependency injection package for application wiring.
    * **Collections** (`sdk/v0.53/build/packages/collections`) - Collections package for state management utilities.

  * **Tooling**
    * **Tooling Overview** (`sdk/v0.53/build/tooling`) - Overview of development tools and utilities.
    * **Protobuf** (`sdk/v0.53/build/tooling/protobuf`) - Protocol buffer tooling and code generation.
    * **Cosmovisor** (`sdk/v0.53/build/tooling/cosmovisor`) - Cosmovisor tool for automatic upgrade management.
    * **Confix** (`sdk/v0.53/build/tooling/confix`) - Confix tool for configuration file management.

  * **ADRs (Architecture Decision Records)**
    * **README** (`sdk/v0.53/build/architecture/README`) - Overview of Architecture Decision Records documenting high-level design decisions.
    * **PROCESS** (`sdk/v0.53/build/architecture/PROCESS`) - Process for creating and maintaining ADRs.
    * **ADR-002: Docs Structure** (`sdk/v0.53/build/architecture/adr-002-docs-structure`) - Documentation structure decision.
    * **ADR-003: Dynamic Capability Store** (`sdk/v0.53/build/architecture/adr-003-dynamic-capability-store`) - Dynamic capability store design.
    * **ADR-004: Split Denomination Keys** (`sdk/v0.53/build/architecture/adr-004-split-denomination-keys`) - Denomination key splitting approach.
    * **ADR-006: Secret Store Replacement** (`sdk/v0.53/build/architecture/adr-006-secret-store-replacement`) - Secret store replacement design.
    * **ADR-007: Specialization Groups** (`sdk/v0.53/build/architecture/adr-007-specialization-groups`) - Specialization groups architecture.
    * **ADR-008: dCERT Group** (`sdk/v0.53/build/architecture/adr-008-dCERT-group`) - dCERT group implementation.
    * **ADR-009: Evidence Module** (`sdk/v0.53/build/architecture/adr-009-evidence-module`) - Evidence module design.
    * **ADR-010: Modular AnteHandler** (`sdk/v0.53/build/architecture/adr-010-modular-antehandler`) - Modular antehandler architecture.
    * **ADR-011: Generalize Genesis Accounts** (`sdk/v0.53/build/architecture/adr-011-generalize-genesis-accounts`) - Genesis account generalization.
    * **ADR-012: State Accessors** (`sdk/v0.53/build/architecture/adr-012-state-accessors`) - State accessor patterns.
    * **ADR-013: Metrics** (`sdk/v0.53/build/architecture/adr-013-metrics`) - Metrics and telemetry architecture.
    * **ADR-014: Proportional Slashing** (`sdk/v0.53/build/architecture/adr-014-proportional-slashing`) - Proportional slashing mechanism.
    * **ADR-016: Validator Consensus Key Rotation** (`sdk/v0.53/build/architecture/adr-016-validator-consensus-key-rotation`) - Consensus key rotation design.
    * **ADR-017: Historical Header Module** (`sdk/v0.53/build/architecture/adr-017-historical-header-module`) - Historical header storage.
    * **ADR-018: Extendable Voting Period** (`sdk/v0.53/build/architecture/adr-018-extendable-voting-period`) - Extendable voting period mechanism.
    * **ADR-019: Protobuf State Encoding** (`sdk/v0.53/build/architecture/adr-019-protobuf-state-encoding`) - Protocol buffer state encoding.
    * **ADR-020: Protobuf Transaction Encoding** (`sdk/v0.53/build/architecture/adr-020-protobuf-transaction-encoding`) - Protocol buffer transaction encoding.
    * **ADR-021: Protobuf Query Encoding** (`sdk/v0.53/build/architecture/adr-021-protobuf-query-encoding`) - Protocol buffer query encoding.
    * **ADR-022: Custom Panic Handling** (`sdk/v0.53/build/architecture/adr-022-custom-panic-handling`) - Custom panic recovery mechanisms.
    * **ADR-023: Protobuf Naming** (`sdk/v0.53/build/architecture/adr-023-protobuf-naming`) - Protocol buffer naming conventions.
    * **ADR-024: Coin Metadata** (`sdk/v0.53/build/architecture/adr-024-coin-metadata`) - Coin metadata structure.
    * **ADR-027: Deterministic Protobuf Serialization** (`sdk/v0.53/build/architecture/adr-027-deterministic-protobuf-serialization`) - Deterministic serialization approach.
    * **ADR-028: Public Key Addresses** (`sdk/v0.53/build/architecture/adr-028-public-key-addresses`) - Public key to address mapping.
    * **ADR-029: Fee Grant Module** (`sdk/v0.53/build/architecture/adr-029-fee-grant-module`) - Fee grant module design.
    * **ADR-030: Authz Module** (`sdk/v0.53/build/architecture/adr-030-authz-module`) - Authorization module architecture.
    * **ADR-031: Msg Service** (`sdk/v0.53/build/architecture/adr-031-msg-service`) - Message service implementation.
    * **ADR-032: Typed Events** (`sdk/v0.53/build/architecture/adr-032-typed-events`) - Typed event system.
    * **ADR-033: Protobuf Inter-Module Communication** (`sdk/v0.53/build/architecture/adr-033-protobuf-inter-module-comm`) - Inter-module communication patterns.
    * **ADR-034: Account Rekeying** (`sdk/v0.53/build/architecture/adr-034-account-rekeying`) - Account rekeying mechanism.
    * **ADR-035: Rosetta API Support** (`sdk/v0.53/build/architecture/adr-035-rosetta-api-support`) - Rosetta API integration.
    * **ADR-036: Arbitrary Signature** (`sdk/v0.53/build/architecture/adr-036-arbitrary-signature`) - Arbitrary signature support.
    * **ADR-037: Gov Split Vote** (`sdk/v0.53/build/architecture/adr-037-gov-split-vote`) - Governance split voting mechanism.
    * **ADR-038: State Listening** (`sdk/v0.53/build/architecture/adr-038-state-listening`) - State change listening system.
    * **ADR-039: Epoched Staking** (`sdk/v0.53/build/architecture/adr-039-epoched-staking`) - Epoch-based staking design.
    * **ADR-040: Storage and SMT State Commitments** (`sdk/v0.53/build/architecture/adr-040-storage-and-smt-state-commitments`) - Sparse Merkle Tree state commitments.
    * **ADR-041: In-Place Store Migrations** (`sdk/v0.53/build/architecture/adr-041-in-place-store-migrations`) - In-place migration strategy.
    * **ADR-042: Group Module** (`sdk/v0.53/build/architecture/adr-042-group-module`) - Group module architecture.
    * **ADR-043: NFT Module** (`sdk/v0.53/build/architecture/adr-043-nft-module`) - NFT module design.
    * **ADR-044: Protobuf Updates Guidelines** (`sdk/v0.53/build/architecture/adr-044-protobuf-updates-guidelines`) - Guidelines for protobuf updates.
    * **ADR-045: Check DeliverTx Middlewares** (`sdk/v0.53/build/architecture/adr-045-check-delivertx-middlewares`) - DeliverTx middleware design.
    * **ADR-046: Module Params** (`sdk/v0.53/build/architecture/adr-046-module-params`) - Module parameter management.
    * **ADR-047: Extend Upgrade Plan** (`sdk/v0.53/build/architecture/adr-047-extend-upgrade-plan`) - Upgrade plan extension mechanism.
    * **ADR-048: Consensus Fees** (`sdk/v0.53/build/architecture/adr-048-consensus-fees`) - Consensus fee distribution.
    * **ADR-049: State Sync Hooks** (`sdk/v0.53/build/architecture/adr-049-state-sync-hooks`) - State synchronization hooks.
    * **ADR-050: Sign Mode Textual** (`sdk/v0.53/build/architecture/adr-050-sign-mode-textual`) - Textual sign mode implementation.
    * **ADR-050: Sign Mode Textual Annex 1** (`sdk/v0.53/build/architecture/adr-050-sign-mode-textual-annex1`) - Textual sign mode annex 1.
    * **ADR-050: Sign Mode Textual Annex 2** (`sdk/v0.53/build/architecture/adr-050-sign-mode-textual-annex2`) - Textual sign mode annex 2.
    * **ADR-053: Go Module Refactoring** (`sdk/v0.53/build/architecture/adr-053-go-module-refactoring`) - Go module structure refactoring.
    * **ADR-054: Semver Compatible Modules** (`sdk/v0.53/build/architecture/adr-054-semver-compatible-modules`) - Semantic versioning for modules.
    * **ADR-055: ORM** (`sdk/v0.53/build/architecture/adr-055-orm`) - Object-Relational Mapping design.
    * **ADR-057: App Wiring** (`sdk/v0.53/build/architecture/adr-057-app-wiring`) - Application wiring architecture.
    * **ADR-058: Auto-Generated CLI** (`sdk/v0.53/build/architecture/adr-058-auto-generated-cli`) - Automatic CLI generation.
    * **ADR-059: Test Scopes** (`sdk/v0.53/build/architecture/adr-059-test-scopes`) - Testing scope management.
    * **ADR-060: ABCI 1.0 (Phase I)** (`sdk/v0.53/build/architecture/adr-060-abci-1.0`) - ABCI 1.0 implementation phase 1.
    * **ADR-061: Liquid Staking** (`sdk/v0.53/build/architecture/adr-061-liquid-staking`) - Liquid staking mechanism.
    * **ADR-062: Collections State Layer** (`sdk/v0.53/build/architecture/adr-062-collections-state-layer`) - Collections-based state management.
    * **ADR-063: Core Module API** (`sdk/v0.53/build/architecture/adr-063-core-module-api`) - Core module API design.
    * **ADR-064: ABCI 2.0** (`sdk/v0.53/build/architecture/adr-064-abci-2.0`) - ABCI 2.0 implementation.
    * **ADR-065: Store V2** (`sdk/v0.53/build/architecture/adr-065-store-v2`) - Store version 2 architecture.
    * **ADR-068: PreBlock** (`sdk/v0.53/build/architecture/adr-068-preblock`) - PreBlock hook implementation.
    * **ADR-070: Unordered Account** (`sdk/v0.53/build/architecture/adr-070-unordered-account`) - Unordered account sequence handling.
    * **ADR-076: Transaction Malleability** (`sdk/v0.53/build/architecture/adr-076-tx-malleability`) - Transaction malleability prevention.

  * **RFC (Request for Comments)**
    * **RFC Overview** (`sdk/v0.53/build/rfc`) - Overview of RFCs for proposing and discussing new features.
    * **PROCESS** (`sdk/v0.53/build/rfc/PROCESS`) - Process for creating and submitting RFCs.
    * **RFC-001: Transaction Validation** (`sdk/v0.53/build/rfc/rfc-001-tx-validation`) - Transaction validation RFC.
    * **RFC Template** (`sdk/v0.53/build/rfc/rfc-template`) - Template for creating new RFCs.

  * **Specifications**
    * **Spec Overview** (`sdk/v0.53/build/spec`) - Overview of SDK specifications and standards.
    * **Module Specification** (`sdk/v0.53/build/spec/SPEC_MODULE`) - Specification for module development.
    * **Standard Specification** (`sdk/v0.53/build/spec/SPEC_STANDARD`) - Standard specifications for SDK components.
    * **Addresses Specification**
      * **Addresses** (`sdk/v0.53/build/spec/addresses/addresses`) - Address format and structure specification.
      * **Bech32** (`sdk/v0.53/build/spec/addresses/bech32`) - Bech32 encoding specification for addresses.
    * **Store Specification**
      * **Store** (`sdk/v0.53/build/spec/store/store`) - Store interface and implementation specification.
      * **Interblock Cache** (`sdk/v0.53/build/spec/store/interblock-cache`) - Inter-block caching mechanism specification.

---

## Tab: User Guides

### Cosmos SDK

* **User Guides** (`sdk/v0.53/user`) - Essential guides for developers using the Cosmos SDK to build and operate applications.

  * **Running a Node, API and CLI**
    * **Keyring** (`sdk/v0.53/user/run-node/keyring`) - Setting up secure key management using the Cosmos SDK keyring for cryptographic key handling.
    * **Run Node** (`sdk/v0.53/user/run-node/run-node`) - Step-by-step instructions to deploy and manage a node in the Cosmos network.
    * **Interact with Node** (`sdk/v0.53/user/run-node/interact-node`) - Using the Command Line Interface (CLI) to navigate and interact with Cosmos SDK applications.
    * **Transactions** (`sdk/v0.53/user/run-node/txs`) - Guide for creating, signing, and broadcasting transactions.
    * **Run Testnet** (`sdk/v0.53/user/run-node/run-testnet`) - Setting up and running nodes on test networks.
    * **Run Production** (`sdk/v0.53/user/run-node/run-production`) - Best practices and configuration for running production nodes.

---

## Tab: Tutorials

### Cosmos SDK

* **Tutorials** (`sdk/v0.53/tutorials`) - Advanced tutorials focused on implementing vote extensions and building transactions in the Cosmos SDK.

  * **Vote Extensions Tutorials**
    * **Mitigating Auction Front-Running Tutorial**
      * **Getting Started** (`sdk/v0.53/tutorials/vote-extensions/auction-frontrunning/getting-started`) - Introduction to the auction front-running mitigation tutorial.
      * **Understanding Frontrunning** (`sdk/v0.53/tutorials/vote-extensions/auction-frontrunning/understanding-frontrunning`) - Explanation of front-running attacks and their impact on auctions.
      * **Mitigating Front-Running with Vote Extensions** (`sdk/v0.53/tutorials/vote-extensions/auction-frontrunning/mitigating-front-running-with-vote-extensions`) - Implementation guide for preventing front-running using vote extensions.
      * **Mitigating Front-Running with Vote Extensions (Alt)** (`sdk/v0.53/tutorials/vote-extensions/auction-frontrunning/mitigating-front-running-with-vote-extesions`) - Alternative approach to front-running mitigation.
      * **Demo of Mitigating Front-Running** (`sdk/v0.53/tutorials/vote-extensions/auction-frontrunning/demo-of-mitigating-front-running`) - Demonstration of the front-running mitigation solution.
    * **Oracle Tutorial**
      * **Getting Started** (`sdk/v0.53/tutorials/vote-extensions/oracle/getting-started`) - Introduction to implementing an oracle with vote extensions.
      * **What is an Oracle** (`sdk/v0.53/tutorials/vote-extensions/oracle/what-is-an-oracle`) - Explanation of oracles and their role in blockchain applications.
      * **Implementing Vote Extensions** (`sdk/v0.53/tutorials/vote-extensions/oracle/implementing-vote-extensions`) - Step-by-step guide for implementing vote extensions in an oracle.
      * **Testing Oracle** (`sdk/v0.53/tutorials/vote-extensions/oracle/testing-oracle`) - Testing strategies and examples for the oracle implementation.

  * **Transaction Tutorials**
    * **Building a Transaction** (`sdk/v0.53/tutorials/transactions/building-a-transaction`) - Tutorial on creating and structuring transactions in the Cosmos SDK.
