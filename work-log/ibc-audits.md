# ibc-audits

## 2026-10-06

- Rewrote `ibc/{latest,next}/security-audits.mdx` to cover all IBC implementations rather than ibc-go alone. The page serves as the canonical audit index, so it now groups reports by protocol, Go implementation, Solidity and Ethereum light client, and Solana implementation.
- Added two audits already published in `cosmos/ibc-contracts` but missing from the page: Zellic's March 2025 IBC Eureka assessment of the Solidity contracts and Ethereum light client (37 pages), and Zenith's February to March 2026 assessment of the Solana programs (62 pages). Audited commits and scope taken from the reports themselves.
- Corrected the IBC v2 audit attribution from "Collaborative Audit Team" to Sherlock, confirmed by the identical report published as `2025-04-03-sherlock.pdf` in ibc-contracts.
- Added a security disclosure link for ibc-contracts alongside the existing ibc-go policy.
- Pending: the ibc-solidity v3, ibc-go attestation light client and GMP, and ibc-attestor reports are not yet published. Download links expired and Serdar has requested replacements. Tracked in FOU-1803.
