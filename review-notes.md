# PR #241 Review Notes — CosmJS Concepts Docs

**PR:** https://github.com/cosmos/docs/pull/241
**Title:** Cosmjs docs: Concepts
**Reviewer:** Technical accuracy review against CosmJS source (`/Users/evan/Documents/GitHub/cosmjs`) and Cosmos SDK source (`/Users/evan/Documents/GitHub/cosmos-sdk`)
**Date:** 2026-03-10

---

## Scope

PR adds ~3,500 lines of new documentation across ~48 new MDX files under `cosmjs/v0.38.x/concepts/`, plus moves existing `cosmjs/overview.mdx` and `cosmjs/getting-started.mdx` into versioned paths, updates `docs.json` navigation, and updates two SDK cross-reference links.

Reviewed files verified line-by-line against CosmJS package source code.

---

## Methodology

1. Fetched the full diff via `gh pr diff 241 --repo cosmos/docs`
2. For each new file, verified claims, interface definitions, function signatures, import paths, and code examples against:
   - `@cosmjs/amino` → `packages/amino/src/`
   - `@cosmjs/proto-signing` → `packages/proto-signing/src/`
   - `@cosmjs/stargate` → `packages/stargate/src/`
   - `@cosmjs/cosmwasm` → `packages/cosmwasm/src/`
   - `@cosmjs/cosmwasm-stargate` → `packages/cosmwasm-stargate/src/`
   - `@cosmjs/tendermint-rpc` → `packages/tendermint-rpc/src/`
   - `@cosmjs/crypto` → `packages/crypto/src/`
   - `@cosmjs/encoding` → `packages/encoding/src/`

---

## File-by-File Review

### `concepts/account/account.mdx`
**Status: Accurate**

- `Account` interface matches `packages/stargate/src/accounts.ts` exactly (address, pubkey, accountNumber, sequence).
- `AccountData` interface matches `packages/amino/src/signer.ts` exactly (address, algo, pubkey).
- `StargateClient.connect()` and `getAccount()` usage is correct.
- Description of pubkey being `null` until the account sends its first transaction is accurate.

### `concepts/account/bech32-addresses.mdx`
**Status: Accurate**

- `toBech32`, `fromBech32`, `normalizeBech32` all exported from `@cosmjs/encoding` (`packages/encoding/src/index.ts`). ✓
- Address derivation table verified against `packages/amino/src/addresses.ts`:
  - secp256k1: `ripemd160(sha256(compressed))` ✓ (see `rawSecp256k1PubkeyToRawAddress`)
  - ed25519: `sha256(pubkey).slice(0, 20)` ✓ (see `rawEd25519PubkeyToRawAddress`)
  - eth_secp256k1: `keccak256(uncompressed[1:]).slice(-20)` ✓ (see `rawEthSecp256k1PubkeyToRawAddress`)
  - multisig: `sha256(aminoEncodedPubkey).slice(0, 20)` ✓ (see `pubkeyToRawAddress` branch for `isMultisigThresholdPubkey`)
- `pubkeyToAddress` is exported from `@cosmjs/amino` (`packages/amino/src/index.ts` line 2). ✓

### `concepts/account/injected-wallets.mdx`
**Status: ONE INACCURACY FOUND AND FIXED**

- **INACCURACY:** The "Choosing the Signing Mode" section described `window.keplr.getOfflineSignerAuto(chainId)` as "Direct only — most compact encoding, but not all features supported." This is wrong. `getOfflineSignerAuto` is the **async** version of `getOfflineSigner` — it also auto-detects between Direct and Amino based on what the wallet supports. It is not "Direct only." The variable was also misleadingly named `directSigner`.
- **Fix applied:** Updated the comment to "Auto (async) — same auto-detection as getOfflineSigner, returns Promise<OfflineSigner>", renamed the variable to `asyncSigner`, and updated the explanatory text below the block.
- All other content (Basic Integration, Detecting the Extension, Suggesting a Chain) is accurate.

### `concepts/account/local-wallets.mdx`
**Status: Accurate**

- `DirectSecp256k1HdWallet` from `@cosmjs/proto-signing` ✓
- `Secp256k1HdWallet` from `@cosmjs/amino` ✓
- `wallet.mnemonic` is a public getter on `DirectSecp256k1HdWallet` (`packages/proto-signing/src/directsecp256k1hdwallet.ts` line 263). ✓
- `DirectSecp256k1HdWallet.generate(24, { prefix })` signature correct. ✓
- `wallet.serialize()` / `DirectSecp256k1HdWallet.deserialize()` methods exist. ✓
- `makeCosmoshubPath` is exported from `@cosmjs/amino`. ✓

### `concepts/account/offline-signers.mdx`
**Status: Accurate**

- `type OfflineSigner = OfflineAminoSigner | OfflineDirectSigner` matches `packages/proto-signing/src/signer.ts` line 26. ✓
- `OfflineDirectSigner` interface (getAccounts, signDirect) correct. ✓
- `OfflineAminoSigner` interface (getAccounts, signAmino with StdSignDoc) correct. ✓
- Signer table: `LedgerSigner` from `@cosmjs/ledger-amino` ✓ (`packages/ledger-amino/src/index.ts` exports `LedgerSigner`).

### `concepts/clients/read-only-clients.mdx`
**Status: Accurate**

- `StargateClient.connect()` and `StargateClient.create()` factory methods exist. ✓
- All query methods in the table are verified present on `StargateClient`. ✓
- `StargateClientOptions` with `accountParser` field exists (`packages/stargate/src/stargateclient.ts`). ✓
- `CosmWasmClient` from `@cosmjs/cosmwasm` — valid; `packages/cosmwasm/src/index.ts` exports `CosmWasmClient`. ✓
- `getContractsByCreator` is on `CosmWasmClient` (`packages/cosmwasm/src/cosmwasmclient.ts` line 400). ✓
- `connectComet`, `QueryClient.withExtensions`, all listed extension setup functions (`setupBankExtension`, `setupStakingExtension`, etc.) verified exported from `@cosmjs/stargate`. ✓
- `setupWasmExtension` is from `@cosmjs/cosmwasm`, not `@cosmjs/stargate` — the table correctly notes this. ✓

### `concepts/clients/signing-clients.mdx`
**Status: Accurate**

- `SigningStargateClient.connectWithSigner()`, `createWithSigner()`, `offline()` all exist. ✓
- All transaction methods verified. ✓
- Fee variants ("auto", number, StdFee) accurate. ✓
- `SigningStargateClientOptions` with `registry`, `aminoTypes`, `broadcastTimeoutMs`, `broadcastPollIntervalMs`, `gasPrice` fields correct (`packages/stargate/src/signingstargateclient.ts`). ✓
- `SigningCosmWasmClient` from `@cosmjs/cosmwasm` valid. ✓
- All CosmWasm transaction methods (upload, instantiate, instantiate2, execute, executeMultiple, migrate, updateAdmin, clearAdmin) verified. ✓

### `concepts/clients/stargate-vs-cosmwasm.mdx`
**Status: Accurate**

- "CosmWasmClient does not extend StargateClient" — verified: `packages/cosmwasm/src/cosmwasmclient.ts` shows `export class CosmWasmClient {` with no extends clause. ✓
- Package attribution table accurate. ✓
- `Registry` from `@cosmjs/proto-signing`, `defaultRegistryTypes` from `@cosmjs/stargate` correct. ✓

### `concepts/cosmos-evm/key-differences.mdx`
**Status: Accurate**

- HD path comparison (118 vs 60) correct. ✓
- Address derivation differences accurate and match source code. ✓
- Sign doc hash difference (SHA-256 vs Keccak-256) accurate. ✓
- Algo identifiers, Amino pubkey type, Protobuf type URL all verified:
  - Amino: `"os/PubKeyEthSecp256k1"` (`packages/amino/src/pubkeys.ts` line 28). ✓
  - Protobuf: `"/cosmos.evm.crypto.v1.ethsecp256k1.PubKey"` (`packages/proto-signing/src/pubkey.ts`). ✓
- `DirectEthSecp256k1HdWallet` and `DirectEthSecp256k1Wallet` wallet classes correct. ✓

### `concepts/cosmos-evm/wallets.mdx`
**Status: Accurate**

- `DirectEthSecp256k1HdWallet.fromMnemonic()` and `generate()` exist. ✓
- `DirectEthSecp256k1Wallet.fromKey(privkeyBytes, prefix)` exists (`packages/proto-signing/src/directethsecp256k1wallet.ts`). ✓
- `stringToPath` from `@cosmjs/crypto` exported at `packages/crypto/src/index.ts`. ✓
- Both wallets report `algo: "eth_secp256k1"` — verified in the wallet source. ✓

### `concepts/cosmos-evm/address-derivation.mdx`
**Status: Accurate**

- Derivation flow for standard Cosmos and EVM verified against `packages/amino/src/addresses.ts`. ✓

### `concepts/cosmos-evm/signing.mdx`
**Status: Accurate**

- Keccak-256 vs SHA-256 pre-sign hash verified. ✓
- Amino type strings and protobuf type URLs verified. ✓
- `isEthereumSecp256k1Account` from `@cosmjs/amino` — exported at `packages/amino/src/index.ts` line 53. ✓
- `getAminoPubkey` from `@cosmjs/amino` — exported and correct (`packages/amino/src/signerutils.ts`). ✓

### `concepts/cosmos-evm/packages.mdx`
**Status: Accurate**

- All exports listed for `@cosmjs/amino`, `@cosmjs/proto-signing`, `@cosmjs/crypto` verified against package index files. ✓
- `keccak256` and `Keccak256` both exported from `@cosmjs/crypto`. ✓

### `concepts/cosmos-evm/querying.mdx`, `signing-client.mdx`, `full-example.mdx`
**Status: Accurate**

- Usage patterns correct and consistent with source. ✓

### `concepts/errors/*`
**Status: Accurate**

- `TimeoutError` with `txId: string` property verified (`packages/stargate/src/stargateclient.ts` lines 26–34). ✓
- `BroadcastTxError` with `code`, `codespace`, `log` properties verified. ✓
- `isDeliverTxSuccess`, `isDeliverTxFailure`, `assertIsDeliverTxSuccess` all exported from `@cosmjs/stargate`. ✓
- Import of `TimeoutError` and `BroadcastTxError` from `@cosmjs/stargate` correct. ✓
- Error messages for encoding, signing, wallet, query, and transport errors match source code patterns. ✓
- `broadcastTx(txBytes, timeoutMs)` second-argument signature verified. ✓

### `concepts/fees-gas/gas-and-fees.mdx`
**Status: Accurate**

- `StdFee` interface (amount, gas, granter, payer) correct. ✓
- `GasPrice.fromString()` and `new GasPrice(Decimal, denom)` constructors correct. ✓
- `Decimal` from `@cosmjs/math` correct. ✓
- `calculateFee(gasLimit, gasPrice)` — accepts both `GasPrice` and `string` (`packages/stargate/src/fee.ts` line 64). ✓
- Default gas multiplier of 1.4x verified (`packages/stargate/src/signingstargateclient.ts` line 125). ✓

### `concepts/fees-gas/simulation.mdx`
**Status: Accurate**

- `simulate()` returning `number` is accurate. ✓
- Default 1.4x multiplier for "auto" fees verified in source. ✓

### `concepts/fees-gas/dynamic-gas-pricing.mdx`
**Status: Accurate**

- `DynamicGasPriceConfig` and `checkDynamicGasPriceSupport` both exported from `@cosmjs/stargate`. ✓
- Osmosis and Skip feemarket support noted accurately. ✓

### `concepts/fees-gas/fee-grants.mdx`
**Status: Accurate**

- `setupFeegrantExtension` from `@cosmjs/stargate` verified. ✓
- `queryClient.feegrant.allowance()` and `allowances()` usage correct. ✓

### `concepts/messages-encoding/*`
**Status: Accurate**

- `EncodeObject` interface correct. ✓
- `MsgSendEncodeObject` and other typed encode objects from `@cosmjs/stargate` correct. ✓
- `Registry` API (register, lookupType, encode, encodeAsAny, encodeTxBody, decode, decodeTxBody) verified. ✓
- `makeAuthInfoBytes` signature (signers, feeAmount, gasLimit, feeGranter, feePayer, signMode?) verified against source. ✓
- `SignDoc` interface (bodyBytes, authInfoBytes, chainId, accountNumber) correct. ✓
- `makeSignDoc`, `makeSignBytes` from `@cosmjs/proto-signing` correct. ✓
- `decodeTxRaw` from `@cosmjs/proto-signing` correct. ✓
- Amino encoding flow (sortedJsonStringify, StdSignDoc, AminoTypes) accurate. ✓

### `concepts/transactions/*`
**Status: Accurate**

- All `signAndBroadcast`, `signAndBroadcastSync`, `sign`, `broadcastTx` methods verified. ✓
- `isOfflineDirectSigner` from `@cosmjs/proto-signing` verified. ✓
- IBC `MsgTransfer` usage with `Height` type correct. ✓
- `SigningCosmWasmClient` methods (upload, instantiate, execute, migrate, etc.) accurate. ✓

### `concepts/transports/*`
**Status: Accurate**

- `HttpClient`, `HttpBatchClient`, `WebsocketClient` all exported from `@cosmjs/tendermint-rpc`. ✓
- `HttpBatchClientOptions` (dispatchInterval, batchSizeLimit, httpTimeout) correct. ✓
- `Comet38Client`, `Comet1Client`, `Tendermint37Client` all exported from `@cosmjs/tendermint-rpc`. ✓
- WebSocket reconnection stack description accurate. ✓
- Broadcast timeout defaults (60,000ms timeout, 3,000ms poll interval) verified in source. ✓

### Navigation and Cross-Reference Changes
**Status: Accurate**

- `docs.json` navigation restructuring is internally consistent.
- Cross-reference link updates from `/cosmjs/getting-started` to `/cosmjs/v0.38.x/quick-start` in `sdk/v0.50/` docs are correct.

---

## Summary

| File | Status | Notes |
|------|--------|-------|
| `account/account.mdx` | ✅ Accurate | |
| `account/bech32-addresses.mdx` | ✅ Accurate | |
| `account/injected-wallets.mdx` | ⚠️ Fixed | `getOfflineSignerAuto` wrongly called "Direct only" |
| `account/local-wallets.mdx` | ✅ Accurate | |
| `account/offline-signers.mdx` | ✅ Accurate | |
| `clients/read-only-clients.mdx` | ✅ Accurate | |
| `clients/signing-clients.mdx` | ✅ Accurate | |
| `clients/stargate-vs-cosmwasm.mdx` | ✅ Accurate | |
| `cosmos-evm/*.mdx` (8 files) | ✅ Accurate | |
| `errors/*.mdx` (9 files) | ✅ Accurate | |
| `fees-gas/*.mdx` (4 files) | ✅ Accurate | |
| `messages-encoding/*.mdx` (6 files) | ✅ Accurate | |
| `transactions/*.mdx` (5 files) | ✅ Accurate | |
| `transports/*.mdx` (5 files) | ✅ Accurate | |
| `overview.mdx`, `quick-start.mdx` | ✅ Accurate | Moved to versioned path |
| `docs.json` | ✅ Accurate | |
| SDK cross-reference links | ✅ Accurate | |

**Total inaccuracies found: 1. All fixed.**
