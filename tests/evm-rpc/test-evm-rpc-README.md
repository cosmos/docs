# Cosmos EVM JSON-RPC Test Suite

Quick test script to validates all described EVM RPC methods against a local node.

## Features

- Tests all standard Ethereum JSON-RPC methods
- Tests Cosmos-specific extensions
- Uses both HTTP and WebSocket endpoints
- Prints summary report

## Installation

```bash
npm install axios ws ethers
# or
yarn add axios ws ethers
```

## Usage

```bash
# Test against default localhost endpoints
node test-evm-rpc.js

# Test against custom endpoints
node test-evm-rpc.js http://your-node:8545 ws://your-node:8546
```

## Test Categories

1. **Web3 Methods** - `web3_clientVersion`, `web3_sha3`
2. **Net Methods** - `net_version`, `net_peerCount`, `net_listening`
3. **Core Eth Methods** - Basic functionality like `eth_blockNumber`, `eth_chainId`
4. **Account & State Methods** - `eth_getBalance`, `eth_getCode`, etc.
5. **Block Methods** - Block querying and uncle methods
6. **Transaction Methods** - Transaction operations and queries
7. **Filter Methods** - Event filtering and logs
8. **Mining Methods** - Mining-related methods (mostly no-ops in Cosmos)
9. **EIP-1559 Methods** - Fee history and priority fees
10. **Personal Methods** - Account management
11. **TxPool Methods** - Transaction pool inspection
12. **Debug Methods** - Debugging and tracing
13. **Cosmos Extensions** - Cosmos-specific methods
14. **Engine API** - Post-merge methods (not implemented)
15. **WebSocket Tests** - Subscription functionality

## Output

The script provides:

- Real-time test results with color coding:
  - 🟢 **PASS** - Method works correctly
  - 🔴 **FAIL** - Method failed unexpectedly
  - 🟡 **NOT_IMPL** - Method not implemented (expected)
  - ⚪ **SKIP** - Method skipped (requires setup)

- Summary report showing:
  - Total passed/failed/not implemented/skipped
  - List of failed methods with error messages

## Configuration

Before running, ensure the node has JSON-RPC enabled and accessible from your test location:

```toml
# app.toml
[json-rpc]
enable = true
address = "127.0.0.1:8545"
ws-address = "127.0.0.1:8546"
api = "eth,web3,net,txpool,debug,personal,miner"
```

## Notes

- Some methods skipped here because they require:
  - Unlocked accounts (`eth_sign`, `personal_sign`)
  - Signed transactions (`eth_sendRawTransaction`)
  - Specific transaction hashes (`debug_traceTransaction`)
  - State modifications (`personal_newAccount`)

- Methods that always return static values in Cosmos:
  - `eth_mining` - Always returns false
  - `eth_hashrate` - Always returns 0
  - Uncle methods - Always return 0 or null

- Cosmos-specific extensions are clearly marked

## To enable some skipped methods

You must use a (funded) account:

```js
const TEST_ACCOUNT = '<your_test_wallet>';
const TEST_PRIVATE_KEY = 'your_test_key';
```
