# EIP-712 Signing for Cosmos Transactions

## Overview

This chain implements a novel approach to transaction signing that enables **Cosmos transactions to be signed using the Ethereum Ledger app** via EIP-712 typed data. This provides unified key management for chains that support both EVM and Cosmos transaction types.

## The Problem

Traditional Cosmos chains use:

- **Key Type**: `secp256k1`
- **Ledger App**: Cosmos app
- **Address Format**: Bech32 (derived from SHA256 + RIPEMD160)

EVM-compatible chains need:

- **Key Type**: `eth_secp256k1`
- **Address Format**: Ethereum hex (derived from Keccak256)

The Cosmos Ledger app cannot derive Ethereum-style addresses because it only supports compressed public keys and different hashing algorithms.

## The Solution: EIP-712

[EIP-712](https://eips.ethereum.org/EIPS/eip-712) is a standard for typed structured data hashing and signing. Originally designed for Ethereum dApps, it can be used to sign **any structured data**, including Cosmos transactions.

### How It Works

```sh
┌─────────────────────┐
│ Cosmos Transaction  │
│  (MsgSend, etc.)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Convert to EIP-712  │
│   Typed Data        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Ethereum Ledger    │
│  App Signs with     │
│  eth_secp256k1      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Valid Cosmos TX     │
│   Signature         │
└─────────────────────┘
```

### EIP-712 Structure

A Cosmos transaction is converted to:

```javascript
{
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "string" },
      { name: "salt", type: "string" }
    ],
    Tx: [
      { name: "account_number", type: "string" },
      { name: "chain_id", type: "string" },
      { name: "fee", type: "Fee" },
      { name: "memo", type: "string" },
      { name: "msgs", type: "Msg[]" },
      { name: "sequence", type: "string" }
    ],
    // ... additional types for Fee, Msg, etc.
  },
  primaryType: "Tx",
  domain: {
    name: "Cosmos Web3",
    version: "1.0.0",
    chainId: 7001,
    verifyingContract: "cosmos",
    salt: "0"
  },
  message: {
    account_number: "0",
    chain_id: "evm_7001-1",
    fee: { ... },
    memo: "",
    msgs: [ ... ],
    sequence: "0"
  }
}
```

## Implementation

### CLI Usage (evmd)

#### Key Generation

**Open the Ethereum app** on your Ledger device and run:

```bash
evmd keys add mykey --ledger
```

The key will use `eth_secp256k1` by default.

#### Transaction Signing

```bash
# Example: Bank send
evmd tx bank send mykey cosmos1... 1000aevmd --ledger --chain-id evm_7001-1
```

Your Ledger will display the EIP-712 domain and message hashes for verification.

### Browser Wallet Integration (Keplr)

Wallet developers can integrate EIP-712 signing using the `@evmos/transactions` library:

```typescript
import {
  createTxRawEIP712,
  signatureToWeb3Extension,
} from "@evmos/transactions";

// 1. Create EIP-712 payload from Cosmos transaction
const txRaw = createTxRawEIP712(messages, fee, {
  accountNumber,
  sequence,
  chainId: "evm_7001-1",
});

// 2. Sign with Ethereum provider (MetaMask, Ledger via Ethereum app, etc.)
const signature = await window.ethereum.request({
  method: "eth_signTypedData_v4",
  params: [signerAddress, JSON.stringify(txRaw.eipToSign)],
});

// 3. Convert signature to Cosmos format
const web3Extension = signatureToWeb3Extension(signature);

// 4. Broadcast to chain
const txBytes = txRaw.message.serializeBinary();
await client.broadcastTx(txBytes);
```

See the test web app in the evm repository for a complete working example.

## Why This Approach?

### Cosmos Leger App Limitations

- Cosmos app cannot derive `eth_secp256k1` addresses
- Cosmos app uses different hashing (SHA256+RIPEMD160 vs Keccak256)
- Ethereum app supports uncompressed public keys needed for EVM

## Technical Details

### Key Derivation

- **Algorithm**: `eth_secp256k1`
- **HD Path**: `m/44'/60'/0'/0/0` (Ethereum standard, BIP-44)
- **Public Key Format**: Uncompressed 65-byte ECDSA public key
- **Address Derivation**: Keccak256(pubkey)[12:] → Bech32

### Signature Format

- **Input**: EIP-712 typed data (structured Cosmos transaction)
- **Output**: ECDSA signature (65 bytes: r + s + v)
- **Verification**: Standard ECDSA verification against `eth_secp256k1` pubkey

### EIP-712 Domain Separator

```javascript
{
  name: "Cosmos Web3",
  version: "1.0.0",
  chainId: 7001, // Numeric EVM chain ID
  verifyingContract: "cosmos",
  salt: "0"
}
```

## Reference Implementation

- **CLI Tool**: See `scripts/test_ledger_manual.sh` in the evm repo
- **Web App**: See test-webapp in the evm repository for browser integration

## Further Reading

- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)
- [EIP Compatibility](/docs/evm/next/documentation/evm-compatibility/eip-reference)
- [Ledger Ethereum App Documentation](https://github.com/LedgerHQ/app-ethereum)
