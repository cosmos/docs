---
order: 1
parent:
  order: false
---

# Requests for Comments

A Request for Comments (RFC) is a record of discussion on an open-ended topic
related to the design and implementation of CometBFT, for which no
immediate decision is required.

The purpose of an RFC is to serve as a historical record of a high-level
discussion that might otherwise only be recorded in an ad hoc way (for example,
via gists or Google docs) that are difficult to discover for someone after the
fact. An RFC _may_ give rise to more specific architectural _decisions_ for
CometBFT, but those decisions must be recorded separately in [Architecture
Decision Records (ADR)](https://github.com/cometbft/cometbft/tree/v0.37.x/docs/architecture).

As a rule of thumb, if you can articulate a specific question that needs to be
answered, write an ADR. If you need to explore the topic and get input from
others to know what questions need to be answered, an RFC may be appropriate.

## RFC Content

An RFC should provide:

- A **changelog**, documenting when and how the RFC has changed.
- An **abstract**, briefly summarizing the topic so the reader can quickly tell
  whether it is relevant to their interest.
- Any **background** a reader will need to understand and participate in the
  substance of the discussion (links to other documents are fine here).
- The **discussion**, the primary content of the document.

The [rfc-template.md](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-template.md) file includes placeholders for these
sections.

## Table of Contents

The RFCs listed below are prior to the fork from
[Tendermint Core repository](https://github.com/tendermint/tendermint/),
therefore they have links to it and refer to CometBFT as "Tendermint" or "Tendermint Core".

- [RFC-000: P2P Roadmap](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-000-p2p-roadmap.rst)
- [RFC-001: Storage Engines](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-001-storage-engine.rst)
- [RFC-002: Interprocess Communication](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-002-ipc-ecosystem.md)
- [RFC-003: Performance Taxonomy](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-003-performance-questions.md)
- [RFC-004: E2E Test Framework Enhancements](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-004-e2e-framework.rst)
- [RFC-005: Event System](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-005-event-system.rst)
- [RFC-006: Event Subscription](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-006-event-subscription.md)
- [RFC-007: Deterministic Proto Byte Serialization](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-007-deterministic-proto-bytes.md)
- [RFC-008: Don't Panic](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-008-do-not-panic.md)
- [RFC-009: Consensus Parameter Upgrades](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-009-consensus-parameter-upgrades.md)
- [RFC-010: P2P Light Client](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-010-p2p-light-client.rst)
- [RFC-011: Delete Gas](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-011-delete-gas.md)
- [RFC-012: Event Indexing Revisited](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-012-custom-indexing.md)
- [RFC-013: ABCI++](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-013-abci++.md)
- [RFC-014: Semantic Versioning](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-014-semantic-versioning.md)
- [RFC-015: ABCI++ Tx Mutation](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-015-abci++-tx-mutation.md)
- [RFC-016: Node Architecture](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-016-node-architecture.md)
- [RFC-017: ABCI++ Vote Extension Propagation](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-017-abci++-vote-extension-propag.md)
- [RFC-018: BLS Signature Aggregation Exploration](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-018-bls-agg-exploration.md)
- [RFC-019: Configuration File Versioning](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-019-config-version.md)
- [RFC-020: Onboarding Projects](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-020-onboarding-projects.rst)
- [RFC-021: The Future of the Socket Protocol](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-021-socket-protocol.md)
- [RFC-023: Semi-permanent Testnet](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-023-semi-permanent-testnet.md)
- [RFC-024: Block Structure Consolidation](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-024-block-structure-consolidation.md)

{/* - [RFC-NNN: Title](https://github.com/cometbft/cometbft/blob/v0.37.x/docs/rfc/rfc-NNN-title.md) */}
