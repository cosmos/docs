# Changes Made During PR #241 Review

**PR:** https://github.com/cosmos/docs/pull/241 — CosmJS docs: Concepts
**Date:** 2026-03-10

---

## Change 1

**File:** `cosmjs/v0.38.x/concepts/account/injected-wallets.mdx`

**Section:** "Choosing the Signing Mode"

**What changed:**
- Corrected the comment on `window.keplr.getOfflineSignerAuto()` from `"Direct only — most compact encoding, but not all features supported"` to `"Auto (async) — same auto-detection as getOfflineSigner, returns Promise<OfflineSigner>"`.
- Renamed the variable holding the result from `directSigner` to `asyncSigner` (the old name implied it was a Direct-only signer, which is wrong).
- Updated the explanatory paragraph after the code block to accurately describe both variants.

**Why:**
`getOfflineSignerAuto` is not "Direct only." According to the Keplr wallet API, it is the **async** counterpart to `getOfflineSigner` — both auto-detect the best available signing mode (preferring Direct/Protobuf over Amino) depending on what the connected account supports. The original description implied a false distinction: that `getOfflineSigner` was "auto" while `getOfflineSignerAuto` was "Direct only," which is the opposite of what the function name communicates and how it actually behaves. Calling it "Direct only" could lead developers to use `getOfflineSignerOnlyAmino` unnecessarily when they want to avoid Ledger-incompatible signing, or to misuse `getOfflineSignerAuto` thinking it enforces Direct-only mode.

**Verified against:** Keplr wallet type definitions and the CosmJS `OfflineSigner` abstraction in `@cosmjs/proto-signing` (`packages/proto-signing/src/signer.ts`).

---

## No Other Changes Required

All other content in PR #241 was verified accurate against the CosmJS source code:

- All interface definitions (`Account`, `AccountData`, `OfflineSigner`, `OfflineDirectSigner`, `OfflineAminoSigner`, `StdFee`, `SignDoc`, `StargateClientOptions`, `SigningStargateClientOptions`, etc.) match the source exactly.
- All function signatures (`makeAuthInfoBytes`, `calculateFee`, `GasPrice.fromString`, `connectComet`, `QueryClient.withExtensions`, etc.) are correct.
- All import paths (`@cosmjs/stargate`, `@cosmjs/proto-signing`, `@cosmjs/amino`, `@cosmjs/cosmwasm`, `@cosmjs/tendermint-rpc`, `@cosmjs/crypto`, `@cosmjs/encoding`, `@cosmjs/math`) are valid.
- All address derivation algorithms (secp256k1, ed25519, eth_secp256k1, multisig) match `packages/amino/src/addresses.ts`.
- All EVM-specific type strings (Amino `"os/PubKeyEthSecp256k1"`, Protobuf `"/cosmos.evm.crypto.v1.ethsecp256k1.PubKey"`) are correct.
- All error class definitions (`TimeoutError`, `BroadcastTxError`) and utility functions (`isDeliverTxSuccess`, `assertIsDeliverTxSuccess`, etc.) are correct.
- Default gas multiplier (1.4×) and broadcast timeout defaults (60,000 ms / 3,000 ms poll) match source code.
- `CosmWasmClient` correctly described as not extending `StargateClient`.
- `getContractsByCreator` correctly attributed to `CosmWasmClient`, not `StargateClient`.
