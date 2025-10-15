---
title: Chain Parameters
description: "Complete Parameter Reference for Cosmos EVM Chain Setup"
---

This document provides a comprehensive reference for **every adjustable parameter** when building a custom Cosmos EVM blockchain. All information is sourced directly from the `cosmos/evm` codebase.

## Pre-Genesis Code Modifications

These parameters must be modified in source code **before** running `evmd init`.

### 1. Binary Name

**What to Change**: Directory name and all Go imports

**Files to Modify**:

- Directory: `evmd/` → `yourchain/`
- All `*.go` files with import paths
- `go.mod` module declaration

**How to Change**:

```bash
# Rename directory
mv evmd yourchain

# Update all imports
find . -type f -name "*.go" -exec sed -i 's/github.com\/cosmos\/evm\/evmd/github.com\/your-org\/your-chain\/yourchain/g' {} \;

# Update go.mod
# Edit go.mod and change module path
```

### 2. Bech32 Address Prefix

**What It Does**: Defines the address format for your chain (e.g., `cosmos1...`, `evmos1...`)

**Default**: `cosmos`

**File**: `config/config.go:62`

<details>
<summary>View Code (click to expand)</summary>

```go
const (
 // Bech32Prefix defines the Bech32 prefix used for accounts on the exemplary Cosmos EVM blockchain.
 Bech32Prefix = "cosmos"
 // Bech32PrefixAccAddr defines the Bech32 prefix of an account's address.
 Bech32PrefixAccAddr = Bech32Prefix
 // Bech32PrefixAccPub defines the Bech32 prefix of an account's public key.
 Bech32PrefixAccPub = Bech32Prefix + sdk.PrefixPublic
 // Bech32PrefixValAddr defines the Bech32 prefix of a validator's operator address.
 Bech32PrefixValAddr = Bech32Prefix + sdk.PrefixValidator + sdk.PrefixOperator
 // Bech32PrefixValPub defines the Bech32 prefix of a validator's operator public key.
 Bech32PrefixValPub = Bech32Prefix + sdk.PrefixValidator + sdk.PrefixOperator + sdk.PrefixPublic
 // Bech32PrefixConsAddr defines the Bech32 prefix of a consensus node address.
 Bech32PrefixConsAddr = Bech32Prefix + sdk.PrefixValidator + sdk.PrefixConsensus
 // Bech32PrefixConsPub defines the Bech32 prefix of a consensus node public key.
 Bech32PrefixConsPub = Bech32Prefix + sdk.PrefixValidator + sdk.PrefixConsensus + sdk.PrefixPublic
)
```

</details>

**Source**: [`config/config.go:60-74`](https://github.com/cosmos/evm/blob/main/config/config.go#L60-L74)

**How to Change**:

```go
// Replace "cosmos" with your chain's prefix
const Bech32Prefix = "mychain"
```

### 3. BIP44 Coin Type

**What It Does**: HD wallet derivation path for key generation

**Default**: `60` (Ethereum compatibility)

**File**: `crypto/hd/hdpath.go:9`

<details>
<summary>View Code (click to expand)</summary>

```go
var (
 // Bip44CoinType satisfies EIP84. See https://github.com/ethereum/EIPs/issues/84 for more info.
 Bip44CoinType uint32 = 60

 // BIP44HDPath is the default BIP44 HD path used on Ethereum.
 BIP44HDPath = ethaccounts.DefaultBaseDerivationPath.String()
)
```

</details>

**Source**: [`crypto/hd/hdpath.go:7-13`](https://github.com/cosmos/evm/blob/main/crypto/hd/hdpath.go#L7-L13)

**How to Change**:

```go
// Use 60 for Ethereum compatibility, or register unique value at
// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
Bip44CoinType uint32 = 60  // or your registered coin type
```

## Genesis Parameters

These parameters are configured in `~/.evmd/config/genesis.json` after running `evmd init`.

### Chain Identity Parameters

#### Cosmos Chain ID

**What It Does**: String identifier for Cosmos consensus and IBC

**Format**: String (e.g., `"mychain-1"`)

**Genesis Path**: `chain_id` (root level)

**Example**:

```json
{
  "chain_id": "mychain-1"
}
```

**Set During Init**:

```bash
evmd init <moniker> --chain-id mychain-1
```

#### Genesis Time

**What It Does**: UTC timestamp when chain starts producing blocks

**Genesis Path**: `genesis_time` (root level)

**Example**:

```json
{
  "genesis_time": "2024-10-01T00:00:00Z"
}
```

### VM Module Parameters

**Module**: `x/vm`
**Genesis Path**: `app_state.evm.params`
**Parameter Source**: [`x/vm/types/params.go`](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go)

#### evm_denom

**What It Does**: Specifies which bank denomination is the native EVM gas token

**Type**: `string`

**Default**: `"uatom"` ([source: x/vm/types/params.go:21](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L21))

**Genesis Path**: `app_state.evm.params.evm_denom`

<details>
<summary>View Code from params.go (click to expand)</summary>

```go
var (
 // DefaultEVMDenom is the default value for the evm denom
 DefaultEVMDenom = "uatom"
 // DefaultEVMExtendedDenom is the default value for the evm extended denom
 DefaultEVMExtendedDenom = "aatom"
 // DefaultEVMDisplayDenom is the default value for the display denom in the bank metadata
 DefaultEVMDisplayDenom = "atom"
 // DefaultEVMChainID is the default value for the evm chain ID
 DefaultEVMChainID uint64 = 262144
 // DefaultEVMDecimals is the default value for the evm denom decimal precision
 DefaultEVMDecimals uint64 = 18
)
```

</details>

**How to Configure** (from [local_node.sh:238,245](https://github.com/cosmos/evm/blob/main/local_node.sh#L238)):

```bash
jq '.app_state["evm"]["params"]["evm_denom"]="atest"' genesis.json > tmp && mv tmp genesis.json
```

**Example Genesis**:

```json
{
  "app_state": {
    "evm": {
      "params": {
        "evm_denom": "atest"
      }
    }
  }
}
```

**⚠️ Critical**: Must match `app_state.bank.denom_metadata[].base`

#### active_static_precompiles

**What It Does**: List of precompiled contract addresses to enable for Cosmos module access

**Type**: `[]string` (array of hex addresses)

**Default**: `[]` (empty array) ([source: x/vm/types/params.go:31](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L31))

**Genesis Path**: `app_state.evm.params.active_static_precompiles`

**Available Precompiles** ([source: x/vm/types/precompiles.go:22-32](https://github.com/cosmos/evm/blob/main/x/vm/types/precompiles.go#L22-L32)):

- `0x0000000000000000000000000000000000000100` - P256 Verification
- `0x0000000000000000000000000000000000000400` - Bech32 Conversion
- `0x0000000000000000000000000000000000000800` - Staking
- `0x0000000000000000000000000000000000000801` - Distribution
- `0x0000000000000000000000000000000000000802` - ICS20 (IBC Transfer)
- `0x0000000000000000000000000000000000000803` - Vesting
- `0x0000000000000000000000000000000000000804` - Bank
- `0x0000000000000000000000000000000000000805` - Governance
- `0x0000000000000000000000000000000000000806` - Slashing
- `0x0000000000000000000000000000000000000807` - Authz

**How to Configure** (from [local_node.sh:243](https://github.com/cosmos/evm/blob/main/local_node.sh#L243)):

```bash
jq '.app_state["evm"]["params"]["active_static_precompiles"]=[
  "0x0000000000000000000000000000000000000100",
  "0x0000000000000000000000000000000000000400",
  "0x0000000000000000000000000000000000000800",
  "0x0000000000000000000000000000000000000801",
  "0x0000000000000000000000000000000000000802",
  "0x0000000000000000000000000000000000000803",
  "0x0000000000000000000000000000000000000804",
  "0x0000000000000000000000000000000000000805",
  "0x0000000000000000000000000000000000000806",
  "0x0000000000000000000000000000000000000807"
]' genesis.json > tmp && mv tmp genesis.json
```

**Example Genesis**:

```json
{
  "app_state": {
    "evm": {
      "params": {
        "active_static_precompiles": [
          "0x0000000000000000000000000000000000000100",
          "0x0000000000000000000000000000000000000800"
        ]
      }
    }
  }
}
```

**⚠️ Important**: Array must be sorted for determinism ([source: x/vm/types/params.go:225-229](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L225-L229))

#### access_control

**What It Does**: Permissions for deploying and calling smart contracts

**Type**: `AccessControl` object with `create` and `call` fields

**Default**: Permissionless for both ([source: x/vm/types/params.go:38-47](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L38-L47))

<details>
<summary>View Default Code (click to expand)</summary>

```go
DefaultAccessControl = AccessControl{
 Create: AccessControlType{
  AccessType:        AccessTypePermissionless,
  AccessControlList: DefaultCreateAllowlistAddresses,
 },
 Call: AccessControlType{
  AccessType:        AccessTypePermissionless,
  AccessControlList: DefaultCallAllowlistAddresses,
 },
}
```

</details>

**Access Types** ([source: x/vm/types/params.go:160-165](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L160-L165)):

- `0` = `AccessTypePermissionless` - Anyone can perform action
- `1` = `AccessTypeRestricted` - Block addresses in list (blocklist)
- `2` = `AccessTypePermissioned` - Only addresses in list (allowlist)

**Example Genesis**:

```json
{
  "app_state": {
    "evm": {
      "params": {
        "access_control": {
          "create": {
            "access_type": 0,
            "access_control_list": []
          },
          "call": {
            "access_type": 0,
            "access_control_list": []
          }
        }
      }
    }
  }
}
```

**Permissioned Example** (only specific addresses can deploy):

```json
{
  "access_control": {
    "create": {
      "access_type": 2,
      "access_control_list": [
        "0x1234567890123456789012345678901234567890",
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
      ]
    }
  }
}
```

#### extra_eips

**What It Does**: Enables additional Ethereum Improvement Proposals not in default config

**Type**: `[]int64` (array of EIP numbers)

**Default**: `[]` (empty) ([source: x/vm/types/params.go:33](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L33))

**Genesis Path**: `app_state.evm.params.extra_eips`

**Example Genesis**:

```json
{
  "app_state": {
    "evm": {
      "params": {
        "extra_eips": [1153, 3855]
      }
    }
  }
}
```

**⚠️ Note**: EIPs must be activatable ([validation: x/vm/types/params.go:182-203](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L182-L203))

#### history_serve_window

**What It Does**: How many blocks of historical state to retain for queries

**Type**: `uint64`

**Default**: `8192` (same as EIP-2935) ([source: x/vm/types/params.go:50](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L50))

**Genesis Path**: `app_state.evm.params.history_serve_window`

**Example Genesis**:

```json
{
  "app_state": {
    "evm": {
      "params": {
        "history_serve_window": 8192
      }
    }
  }
}
```

**Values**:

- `0` = Unlimited (keep all historical state)
- `> 0` = Keep last N blocks

#### extended_denom_options

**What It Does**: Required for chains with non-18 decimal native tokens

**Type**: `ExtendedDenomOptions` object

**Default**: `{extended_denom: "aatom"}` ([source: x/vm/types/params.go:76](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L76))

**Genesis Path**: `app_state.evm.params.extended_denom_options`

**When Required**: Only for 6-decimal or other non-18-decimal chains

**Example Genesis** (for 6-decimal chain):

```json
{
  "app_state": {
    "evm": {
      "params": {
        "evm_denom": "utoken",
        "extended_denom_options": {
          "extended_denom": "atoken"
        }
      }
    }
  }
}
```

**⚠️ Critical**: If using non-18 decimals, must also integrate PreciseBank module

#### evm_channels

**What It Does**: List of IBC channels that connect to other EVM chains

**Type**: `[]string` (array of channel IDs)

**Default**: `[]` (empty) ([source: x/vm/types/params.go:35](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L35))

**Genesis Path**: `app_state.evm.params.evm_channels`

**Example Genesis**:

```json
{
  "app_state": {
    "evm": {
      "params": {
        "evm_channels": ["channel-0", "channel-1"]
      }
    }
  }
}
```

### Fee Market Module Parameters

**Module**: `x/feemarket`
**Genesis Path**: `app_state.feemarket.params`
**Parameter Source**: [`x/feemarket/types/params.go`](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go)

#### no_base_fee

**What It Does**: Completely disables EIP-1559 dynamic base fee mechanism

**Type**: `bool`

**Default**: `false` (EIP-1559 enabled) ([source: x/feemarket/types/params.go:21](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L21))

**Genesis Path**: `app_state.feemarket.params.no_base_fee`

**Example Genesis**:

```json
{
  "app_state": {
    "feemarket": {
      "params": {
        "no_base_fee": false
      }
    }
  }
}
```

#### base_fee

**What It Does**: Initial base fee per gas in wei

**Type**: `string` (decimal string)

**Default**: `"1000000000"` (1 gwei) ([source: x/feemarket/types/params.go:13](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L13))

**Genesis Path**: `app_state.feemarket.params.base_fee`

<details>
<summary>View Default Code (click to expand)</summary>

```go
var (
 // DefaultBaseFee for the Cosmos EVM chain
 DefaultBaseFee = math.LegacyNewDec(1_000_000_000)
 // DefaultMinGasMultiplier is 0.5 or 50%
 DefaultMinGasMultiplier = math.LegacyNewDecWithPrec(50, 2)
 // DefaultMinGasPrice is 0 (i.e disabled)
 DefaultMinGasPrice = math.LegacyZeroDec()
 // DefaultEnableHeight is 0 (i.e disabled)
 DefaultEnableHeight = int64(0)
 // DefaultNoBaseFee is false
 DefaultNoBaseFee = false
)
```

</details>

**Example Genesis**:

```json
{
  "app_state": {
    "feemarket": {
      "params": {
        "base_fee": "1000000000"
      }
    }
  }
}
```

**Common Values**:

- `"1000000000"` = 1 gwei (Ethereum mainnet typical)
- `"100000000"` = 0.1 gwei (cheaper L2s)
- `"10000000000"` = 10 gwei (higher fee chains)

#### base_fee_change_denominator

**What It Does**: Controls how fast base fee adjusts per block

**Type**: `uint32`

**Default**: `8` (±12.5% max change per block) ([source: uses go-ethereum default from x/feemarket/types/params.go:51](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L51))

**Genesis Path**: `app_state.feemarket.params.base_fee_change_denominator`

**Example Genesis**:

```json
{
  "app_state": {
    "feemarket": {
      "params": {
        "base_fee_change_denominator": 8
      }
    }
  }
}
```

**How It Works**:

- Formula: `max_change_per_block = 1 / denominator`
- `8` = ±12.5% max change
- `50` = ±2% max change (slower adjustment)
- Lower value = faster price adjustment

#### elasticity_multiplier

**What It Does**: Multiplier for block gas limit elasticity

**Type**: `uint32`

**Default**: `2` ([source: uses go-ethereum default from x/feemarket/types/params.go:52](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L52))

**Genesis Path**: `app_state.feemarket.params.elasticity_multiplier`

**Example Genesis**:

```json
{
  "app_state": {
    "feemarket": {
      "params": {
        "elasticity_multiplier": 2
      }
    }
  }
}
```

**How It Works**:

- Determines target gas usage
- `target_gas = max_gas / elasticity_multiplier`
- With `2`: target is 50% of max gas
- Block above target: base fee increases
- Block below target: base fee decreases

#### min_gas_price

**What It Does**: Network-wide minimum gas price floor (in wei)

**Type**: `string` (decimal string)

**Default**: `"0"` (no floor) ([source: x/feemarket/types/params.go:17](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L17))

**Genesis Path**: `app_state.feemarket.params.min_gas_price`

**Example Genesis**:

```json
{
  "app_state": {
    "feemarket": {
      "params": {
        "min_gas_price": "500000000"
      }
    }
  }
}
```

#### min_gas_multiplier

**What It Does**: Fraction of base fee that constitutes minimum gas price

**Type**: `string` (decimal string between 0 and 1)

**Default**: `"0.5"` (50%) ([source: x/feemarket/types/params.go:15](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L15))

**Genesis Path**: `app_state.feemarket.params.min_gas_multiplier`

**Example Genesis**:

```json
{
  "app_state": {
    "feemarket": {
      "params": {
        "min_gas_multiplier": "0.5"
      }
    }
  }
}
```

**⚠️ Validation**: Must be between 0 and 1 ([source: x/feemarket/types/params.go:101-115](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L101-L115))

#### enable_height

**What It Does**: Block height at which EIP-1559 activates

**Type**: `int64`

**Default**: `0` (enabled from genesis) ([source: x/feemarket/types/params.go:19](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L19))

**Genesis Path**: `app_state.feemarket.params.enable_height`

**Example Genesis**:

```json
{
  "app_state": {
    "feemarket": {
      "params": {
        "enable_height": 0
      }
    }
  }
}
```

### ERC20 Module Parameters

**Module**: `x/erc20`
**Genesis Path**: `app_state.erc20`
**Parameter Source**: [`x/erc20/types/params.go`](https://github.com/cosmos/evm/blob/main/x/erc20/types/params.go)

#### enable_erc20

**What It Does**: Enables/disables ERC20 module functionality

**Type**: `bool`

**Default**: `true` ([source: x/erc20/types/params.go:26](https://github.com/cosmos/evm/blob/main/x/erc20/types/params.go#L26))

**Genesis Path**: `app_state.erc20.params.enable_erc20`

**Example Genesis**:

```json
{
  "app_state": {
    "erc20": {
      "params": {
        "enable_erc20": true
      }
    }
  }
}
```

#### permissionless_registration

**What It Does**: Allows anyone to register new token pairs

**Type**: `bool`

**Default**: `true` ([source: x/erc20/types/params.go:27](https://github.com/cosmos/evm/blob/main/x/erc20/types/params.go#L27))

**Genesis Path**: `app_state.erc20.params.permissionless_registration`

**Example Genesis**:

```json
{
  "app_state": {
    "erc20": {
      "params": {
        "permissionless_registration": true
      }
    }
  }
}
```

#### token_pairs

**What It Does**: Defines mappings between Cosmos denoms and ERC20 addresses

**Type**: Array of `TokenPair` objects

**Default**: Empty array

**Genesis Path**: `app_state.erc20.token_pairs`

**How to Configure** (from [local_node.sh:248](https://github.com/cosmos/evm/blob/main/local_node.sh#L248)):

```bash
jq '.app_state.erc20.token_pairs=[{
  contract_owner:1,
  erc20_address:"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  denom:"atest",
  enabled:true
}]' genesis.json > tmp && mv tmp genesis.json
```

**Example Genesis**:

```json
{
  "app_state": {
    "erc20": {
      "token_pairs": [
        {
          "erc20_address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          "denom": "atest",
          "enabled": true,
          "contract_owner": 1
        }
      ]
    }
  }
}
```

**⚠️ Special Address**: Native token uses `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`

#### native_precompiles

**What It Does**: List of native token precompile addresses

**Type**: `[]string` (array of hex addresses)

**Default**: Empty array

**Genesis Path**: `app_state.erc20.native_precompiles`

**How to Configure** (from [local_node.sh:247](https://github.com/cosmos/evm/blob/main/local_node.sh#L247)):

```bash
jq '.app_state.erc20.native_precompiles=["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"]' genesis.json > tmp && mv tmp genesis.json
```

**Example Genesis**:

```json
{
  "app_state": {
    "erc20": {
      "native_precompiles": ["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"]
    }
  }
}
```

### Bank Module - Denomination Metadata

**Module**: `x/bank` (Cosmos SDK)
**Genesis Path**: `app_state.bank.denom_metadata`

**What It Does**: Defines token denominations, decimals, and display information

**How to Configure** (from [local_node.sh:241](https://github.com/cosmos/evm/blob/main/local_node.sh#L241)):

<details>
<summary>View Configuration Command (click to expand)</summary>

```bash
jq '.app_state["bank"]["denom_metadata"]=[{
  "description":"The native staking token for evmd.",
  "denom_units":[
    {"denom":"atest","exponent":0,"aliases":["attotest"]},
    {"denom":"test","exponent":18,"aliases":[]}
  ],
  "base":"atest",
  "display":"test",
  "name":"Test Token",
  "symbol":"TEST",
  "uri":"",
  "uri_hash":""
}]' genesis.json > tmp && mv tmp genesis.json
```

</details>

**Example Genesis (18 decimals)**:

```json
{
  "app_state": {
    "bank": {
      "denom_metadata": [
        {
          "description": "The native staking token",
          "denom_units": [
            {
              "denom": "atoken",
              "exponent": 0,
              "aliases": ["attotoken"]
            },
            {
              "denom": "token",
              "exponent": 18,
              "aliases": []
            }
          ],
          "base": "atoken",
          "display": "token",
          "name": "Token",
          "symbol": "TOKEN"
        }
      ]
    }
  }
}
```

**Example Genesis (6 decimals)**:

```json
{
  "app_state": {
    "bank": {
      "denom_metadata": [
        {
          "denom_units": [
            {
              "denom": "utoken",
              "exponent": 0
            },
            {
              "denom": "token",
              "exponent": 6
            }
          ],
          "base": "utoken",
          "display": "token"
        }
      ]
    }
  }
}
```

**⚠️ Critical**: `base` denom must match:

- `app_state.evm.params.evm_denom`
- `app_state.staking.params.bond_denom`
- `app_state.mint.params.mint_denom`
- `app_state.gov.params.min_deposit[0].denom`

### Standard Cosmos Module Parameters

#### Staking Module

**Genesis Path**: `app_state.staking.params`

**How to Configure** (from [local_node.sh:234](https://github.com/cosmos/evm/blob/main/local_node.sh#L234)):

```bash
jq '.app_state["staking"]["params"]["bond_denom"]="atest"' genesis.json > tmp && mv tmp genesis.json
```

**Key Parameters**:

- `bond_denom`: Native token for staking (must match base denom)
- `unbonding_time`: Time to wait for unstaking (e.g., `"1814400s"` = 21 days)
- `max_validators`: Maximum number of validators (e.g., `100`)
- `max_entries`: Max unbonding/redelegation entries per delegator
- `historical_entries`: Number of historical info entries to keep

**Example Genesis**:

```json
{
  "app_state": {
    "staking": {
      "params": {
        "bond_denom": "atest",
        "unbonding_time": "1814400s",
        "max_validators": 100,
        "max_entries": 7,
        "historical_entries": 10000
      }
    }
  }
}
```

#### Governance Module

**Genesis Path**: `app_state.gov.params`

**How to Configure** (from [local_node.sh:235-237,253-255](https://github.com/cosmos/evm/blob/main/local_node.sh#L235-L255)):

```bash
jq '.app_state["gov"]["params"]["min_deposit"][0]["denom"]="atest"' genesis.json > tmp && mv tmp genesis.json
sed -i.bak 's/"voting_period": "172800s"/"voting_period": "30s"/g' genesis.json
```

**Key Parameters**:

- `min_deposit`: Minimum deposit to submit proposal
- `max_deposit_period`: Time to reach min deposit (e.g., `"172800s"` = 2 days)
- `voting_period`: Time for voting (e.g., `"172800s"` = 2 days)
- `quorum`: Minimum participation (e.g., `"0.334"` = 33.4%)
- `threshold`: Minimum yes votes (e.g., `"0.5"` = 50%)
- `veto_threshold`: Veto threshold (e.g., `"0.334"` = 33.4%)

**Example Genesis**:

```json
{
  "app_state": {
    "gov": {
      "params": {
        "min_deposit": [
          {
            "denom": "atest",
            "amount": "10000000000000000000"
          }
        ],
        "max_deposit_period": "172800s",
        "voting_period": "172800s",
        "quorum": "0.334",
        "threshold": "0.5",
        "veto_threshold": "0.334"
      }
    }
  }
}
```

#### Mint Module

**Genesis Path**: `app_state.mint.params`

**How to Configure** (from [local_node.sh:239](https://github.com/cosmos/evm/blob/main/local_node.sh#L239)):

```bash
jq '.app_state["mint"]["params"]["mint_denom"]="atest"' genesis.json > tmp && mv tmp genesis.json
```

**Key Parameters**:

- `mint_denom`: Denomination to mint (must match base denom)
- `inflation_rate_change`: Max annual inflation change
- `inflation_max`: Maximum inflation rate
- `inflation_min`: Minimum inflation rate
- `goal_bonded`: Target bonded token ratio
- `blocks_per_year`: Expected blocks per year

**Example Genesis**:

```json
{
  "app_state": {
    "mint": {
      "params": {
        "mint_denom": "atest",
        "inflation_rate_change": "0.130000000000000000",
        "inflation_max": "0.200000000000000000",
        "inflation_min": "0.070000000000000000",
        "goal_bonded": "0.670000000000000000",
        "blocks_per_year": "6311520"
      }
    }
  }
}
```

#### Distribution Module

**Genesis Path**: `app_state.distribution.params`

**Key Parameters**:

- `community_tax`: Percentage to community pool (e.g., `"0.020000000000000000"` = 2%)
- `base_proposer_reward`: Base reward for block proposer
- `bonus_proposer_reward`: Bonus reward for block proposer
- `withdraw_addr_enabled`: Allow setting withdraw address

**Example Genesis**:

```json
{
  "app_state": {
    "distribution": {
      "params": {
        "community_tax": "0.020000000000000000",
        "base_proposer_reward": "0.010000000000000000",
        "bonus_proposer_reward": "0.040000000000000000",
        "withdraw_addr_enabled": true
      }
    }
  }
}
```

### Consensus Parameters

**Genesis Path**: `consensus.params` (root level)

**How to Configure** (from [local_node.sh:250](https://github.com/cosmos/evm/blob/main/local_node.sh#L250)):

```bash
jq '.consensus.params.block.max_gas="10000000"' genesis.json > tmp && mv tmp genesis.json
```

**Example Genesis**:

```json
{
  "consensus": {
    "params": {
      "block": {
        "max_bytes": "22020096",
        "max_gas": "10000000"
      },
      "evidence": {
        "max_age_num_blocks": "100000",
        "max_age_duration": "172800000000000",
        "max_bytes": "1048576"
      },
      "validator": {
        "pub_key_types": ["ed25519"]
      }
    }
  }
}
```

**Key Parameters**:

- `block.max_bytes`: Maximum block size in bytes
- `block.max_gas`: Maximum gas per block (`-1` = unlimited)
- `evidence.max_age_num_blocks`: Evidence validity in blocks
- `evidence.max_age_duration`: Evidence validity in nanoseconds
- `validator.pub_key_types`: Allowed validator key types

**⚠️ Critical**: `max_gas` is read by mempool ([source: config/server_app_options.go:53](https://github.com/cosmos/evm/blob/main/config/server_app_options.go#L53))

## Runtime Configuration (app.toml)

These parameters are configured in `~/.evmd/config/app.toml` and can be changed without restarting the chain.

### EVM Configuration

**Section**: `[evm]`
**Source**: Flags defined in [`server/flags/flags.go:67-82`](https://github.com/cosmos/evm/blob/main/server/flags/flags.go#L67-L82)

#### evm-chain-id

**What It Does**: EIP-155 chain ID for transaction replay protection

**Flag**: `evm.evm-chain-id`

**Default**: `262144` ([source: config/config.go:78](https://github.com/cosmos/evm/blob/main/config/config.go#L78))

**How Read**: [`evmd/app.go:216`](https://github.com/cosmos/evm/blob/main/evmd/app.go#L216)

<details>
<summary>View Code (click to expand)</summary>

```go
evmChainID := cast.ToUint64(appOpts.Get(srvflags.EVMChainID))
encodingConfig := evmencoding.MakeConfig(evmChainID)
```

</details>

**app.toml Configuration**:

```toml
[evm]
evm-chain-id = 262144
```

**⚠️ Critical**: Cannot be changed after genesis. Changing breaks transaction signatures.

#### tracer

**What It Does**: EVM execution tracer type for debugging

**Flag**: `evm.tracer`

**Options**: `"json"`, `"markdown"`, `"struct"`, `""`

**app.toml Configuration**:

```toml
[evm]
tracer = "json"
```

#### max-tx-gas-wanted

**What It Does**: Maximum gas limit for individual transactions

**Flag**: `evm.max-tx-gas-wanted`

**Default**: `0` (unlimited)

**app.toml Configuration**:

```toml
[evm]
max-tx-gas-wanted = 0
```

#### cache-preimage

**What It Does**: Cache preimages for historical state queries

**Flag**: `evm.cache-preimage`

**Default**: `false`

**app.toml Configuration**:

```toml
[evm]
cache-preimage = false
```

#### min-tip

**What It Does**: Minimum priority fee (tip) required for transactions

**Flag**: `evm.min-tip`

**Default**: `0`

**Source**: [`config/server_app_options.go:95-110`](https://github.com/cosmos/evm/blob/main/config/server_app_options.go#L95-L110)

<details>
<summary>View Code (click to expand)</summary>

```go
// GetMinTip reads the min tip from the app options, set from app.toml
// This field is also known as the minimum priority fee
func GetMinTip(appOpts servertypes.AppOptions, logger log.Logger) *uint256.Int {
 if appOpts == nil {
  logger.Error("app options is nil, using zero min tip")
  return nil
 }

 minTipUint64 := cast.ToUint64(appOpts.Get(srvflags.EVMMinTip))
 minTip := uint256.NewInt(minTipUint64)

 if minTip.Cmp(uint256.NewInt(0)) >= 0 { // zero or positive
  return minTip
 }

 logger.Error("invalid min tip value in app.toml or flag, falling back to nil", "min_tip", minTipUint64)
 return nil
}
```

</details>

**app.toml Configuration**:

```toml
[evm]
min-tip = 1000000000
```

**Used By**: Mempool for transaction prioritization ([source: evmd/mempool.go:63](https://github.com/cosmos/evm/blob/main/evmd/mempool.go#L63))

### EVM Mempool Configuration

**Section**: `[evm.mempool]`
**Source**: [`server/flags/flags.go:75-81`](https://github.com/cosmos/evm/blob/main/server/flags/flags.go#L75-L81)
**Defaults**: [`mempool/txpool/legacypool/legacypool.go:156-166`](https://github.com/cosmos/evm/blob/main/mempool/txpool/legacypool/legacypool.go#L156-L166)

<details>
<summary>View Default Config Code (click to expand)</summary>

```go
// DefaultConfig contains the default configurations for the transaction pool.
var DefaultConfig = Config{
 Journal:   "transactions.rlp",
 Rejournal: time.Hour,

 PriceLimit: 1,
 PriceBump:  10,

 AccountSlots: 16,
 GlobalSlots:  4096 + 1024, // urgent + floating queue capacity with 4:1 ratio
 AccountQueue: 64,
 GlobalQueue:  1024,

 Lifetime: 3 * time.Hour,
}
```

</details>

**How Read**: [`config/server_app_options.go:114-144`](https://github.com/cosmos/evm/blob/main/config/server_app_options.go#L114-L144)

#### price-limit

**What It Does**: Minimum gas price to accept into mempool

**Flag**: `evm.mempool.price-limit`

**Default**: `1` wei

**app.toml Configuration**:

```toml
[evm.mempool]
price-limit = 1
```

#### price-bump

**What It Does**: Minimum percentage price increase to replace existing transaction

**Flag**: `evm.mempool.price-bump`

**Default**: `10` (10%)

**app.toml Configuration**:

```toml
[evm.mempool]
price-bump = 10
```

#### account-slots

**What It Does**: Number of executable transaction slots guaranteed per account

**Flag**: `evm.mempool.account-slots`

**Default**: `16`

**app.toml Configuration**:

```toml
[evm.mempool]
account-slots = 16
```

#### global-slots

**What It Does**: Maximum number of executable transaction slots for all accounts

**Flag**: `evm.mempool.global-slots`

**Default**: `5120` (4096 + 1024)

**app.toml Configuration**:

```toml
[evm.mempool]
global-slots = 5120
```

#### account-queue

**What It Does**: Maximum number of non-executable transaction slots per account

**Flag**: `evm.mempool.account-queue`

**Default**: `64`

**app.toml Configuration**:

```toml
[evm.mempool]
account-queue = 64
```

#### global-queue

**What It Does**: Maximum number of non-executable transaction slots for all accounts

**Flag**: `evm.mempool.global-queue`

**Default**: `1024`

**app.toml Configuration**:

```toml
[evm.mempool]
global-queue = 1024
```

#### lifetime

**What It Does**: Maximum time a transaction stays in mempool

**Flag**: `evm.mempool.lifetime`

**Default**: `3h` (3 hours)

**app.toml Configuration**:

```toml
[evm.mempool]
lifetime = "3h"
```

### JSON-RPC Configuration

**Section**: `[json-rpc]`
**Source**: [`server/flags/flags.go:39-64`](https://github.com/cosmos/evm/blob/main/server/flags/flags.go#L39-L64)

**app.toml Configuration**:

```toml
[json-rpc]
enable = true
address = "0.0.0.0:8545"
ws-address = "0.0.0.0:8546"
api = ["eth", "net", "web3", "txpool", "debug"]
gas-cap = 25000000
evm-timeout = "5s"
txfee-cap = 1.0
filter-cap = 200
logs-cap = 10000
block-range-cap = 10000
http-timeout = "30s"
http-idle-timeout = "2m0s"
allow-unprotected-txs = false
max-open-connections = 0
enable-indexer = false
batch-request-limit = 0
batch-response-max-size = 0
```

**Key Parameters**:

- `enable`: Enable JSON-RPC server
- `address`: HTTP server address (⚠️ Use `127.0.0.1` for localhost only)
- `ws-address`: WebSocket server address
- `api`: Enabled API namespaces
- `gas-cap`: Max gas for `eth_call` and `eth_estimateGas`
- `allow-unprotected-txs`: Allow unsigned transactions (⚠️ Only for dev)

### Minimum Gas Prices

**Flag**: `minimum-gas-prices`

**Section**: `[app]` (implicit)

**How to Configure**:

```toml
minimum-gas-prices = "1000000000atest"
```

**Format**: `<amount><denom>` (e.g., `"1000000000atest"` = 1 gwei)

**⚠️ Critical**: Validators reject transactions below this price

## Complete Working Example

This is a complete genesis configuration based on [`local_node.sh`](https://github.com/cosmos/evm/blob/main/local_node.sh):

<details>
<summary>View Complete Genesis JSON (click to expand)</summary>

```json
{
  "chain_id": "evmd-1",
  "genesis_time": "2024-01-01T00:00:00Z",
  "consensus": {
    "params": {
      "block": {
        "max_bytes": "22020096",
        "max_gas": "10000000"
      }
    }
  },
  "app_state": {
    "bank": {
      "denom_metadata": [
        {
          "description": "The native staking token for evmd.",
          "denom_units": [
            {
              "denom": "atest",
              "exponent": 0,
              "aliases": ["attotest"]
            },
            {
              "denom": "test",
              "exponent": 18,
              "aliases": []
            }
          ],
          "base": "atest",
          "display": "test",
          "name": "Test Token",
          "symbol": "TEST"
        }
      ]
    },
    "evm": {
      "params": {
        "evm_denom": "atest",
        "extra_eips": [],
        "active_static_precompiles": [
          "0x0000000000000000000000000000000000000100",
          "0x0000000000000000000000000000000000000400",
          "0x0000000000000000000000000000000000000800",
          "0x0000000000000000000000000000000000000801",
          "0x0000000000000000000000000000000000000802",
          "0x0000000000000000000000000000000000000803",
          "0x0000000000000000000000000000000000000804",
          "0x0000000000000000000000000000000000000805",
          "0x0000000000000000000000000000000000000806",
          "0x0000000000000000000000000000000000000807"
        ],
        "evm_channels": [],
        "access_control": {
          "create": {
            "access_type": 0,
            "access_control_list": []
          },
          "call": {
            "access_type": 0,
            "access_control_list": []
          }
        },
        "history_serve_window": 8192
      }
    },
    "feemarket": {
      "params": {
        "no_base_fee": false,
        "base_fee_change_denominator": 8,
        "elasticity_multiplier": 2,
        "base_fee": "1000000000",
        "enable_height": 0,
        "min_gas_price": "0",
        "min_gas_multiplier": "0.5"
      }
    },
    "erc20": {
      "params": {
        "enable_erc20": true,
        "permissionless_registration": true
      },
      "token_pairs": [
        {
          "erc20_address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          "denom": "atest",
          "enabled": true,
          "contract_owner": 1
        }
      ],
      "native_precompiles": ["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"]
    },
    "staking": {
      "params": {
        "bond_denom": "atest",
        "unbonding_time": "1814400s",
        "max_validators": 100
      }
    },
    "gov": {
      "params": {
        "min_deposit": [
          {
            "denom": "atest",
            "amount": "10000000000000000000"
          }
        ],
        "voting_period": "172800s"
      }
    },
    "mint": {
      "params": {
        "mint_denom": "atest"
      }
    }
  }
}
```

</details>

## Quick Reference Tables

### Module Parameter Defaults

| Module | Parameter | Type | Default | Source Line |
| | -- | -- | -- | |
| VM | `evm_denom` | string | `"uatom"` | [x/vm/types/params.go:21](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L21) |
| VM | `extra_eips` | []int64 | `[]` | [x/vm/types/params.go:33](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L33) |
| VM | `active_static_precompiles` | []string | `[]` | [x/vm/types/params.go:31](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L31) |
| VM | `history_serve_window` | uint64 | `8192` | [x/vm/types/params.go:50](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L50) |
| VM | `access_control.create.access_type` | int | `0` (Permissionless) | [x/vm/types/params.go:40](https://github.com/cosmos/evm/blob/main/x/vm/types/params.go#L40) |
| FeeMarket | `no_base_fee` | bool | `false` | [x/feemarket/types/params.go:21](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L21) |
| FeeMarket | `base_fee` | string | `"1000000000"` | [x/feemarket/types/params.go:13](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L13) |
| FeeMarket | `base_fee_change_denominator` | uint32 | `8` | [x/feemarket/types/params.go:51](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L51) |
| FeeMarket | `elasticity_multiplier` | uint32 | `2` | [x/feemarket/types/params.go:52](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L52) |
| FeeMarket | `min_gas_multiplier` | string | `"0.5"` | [x/feemarket/types/params.go:15](https://github.com/cosmos/evm/blob/main/x/feemarket/types/params.go#L15) |
| ERC20 | `enable_erc20` | bool | `true` | [x/erc20/types/params.go:26](https://github.com/cosmos/evm/blob/main/x/erc20/types/params.go#L26) |
| ERC20 | `permissionless_registration` | bool | `true` | [x/erc20/types/params.go:27](https://github.com/cosmos/evm/blob/main/x/erc20/types/params.go#L27) |

### Mempool Configuration Defaults

| Parameter | Type | Default | Source Line |
| | -- | - | -- |
| `price-limit` | uint64 | `1` wei | [mempool/txpool/legacypool/legacypool.go:161](https://github.com/cosmos/evm/blob/main/mempool/txpool/legacypool/legacypool.go#L161) |
| `price-bump` | uint64 | `10` (10%) | [mempool/txpool/legacypool/legacypool.go:162](https://github.com/cosmos/evm/blob/main/mempool/txpool/legacypool/legacypool.go#L162) |
| `account-slots` | uint64 | `16` | [mempool/txpool/legacypool/legacypool.go:164](https://github.com/cosmos/evm/blob/main/mempool/txpool/legacypool/legacypool.go#L164) |
| `global-slots` | uint64 | `5120` | [mempool/txpool/legacypool/legacypool.go:165](https://github.com/cosmos/evm/blob/main/mempool/txpool/legacypool/legacypool.go#L165) |
| `account-queue` | uint64 | `64` | [mempool/txpool/legacypool/legacypool.go:166](https://github.com/cosmos/evm/blob/main/mempool/txpool/legacypool/legacypool.go#L166) |
| `global-queue` | uint64 | `1024` | [mempool/txpool/legacypool/legacypool.go:167](https://github.com/cosmos/evm/blob/main/mempool/txpool/legacypool/legacypool.go#L167) |
| `lifetime` | duration | `3h` | [mempool/txpool/legacypool/legacypool.go:169](https://github.com/cosmos/evm/blob/main/mempool/txpool/legacypool/legacypool.go#L169) |

### Code Configuration Defaults

| Parameter | File | Line | Default |
| | -- | -- | - |
| Bech32 Prefix | `config/config.go` | [62](https://github.com/cosmos/evm/blob/main/config/config.go#L62) | `"cosmos"` |
| BIP44 Coin Type | `crypto/hd/hdpath.go` | [9](https://github.com/cosmos/evm/blob/main/crypto/hd/hdpath.go#L9) | `60` |
| EVM Chain ID | `config/config.go` | [78](https://github.com/cosmos/evm/blob/main/config/config.go#L78) | `262144` |

## Complete Setup Workflow

1. **Fork and Modify Code**:

   - Rename binary
   - Change Bech32 prefix in `config/config.go:62`
   - Change BIP44 coin type in `crypto/hd/hdpath.go:9`
   - Build: `make build` or `make install`

2. **Initialize Chain**:

   ```bash
   yourchain init <moniker> --chain-id yourchain-1
   ```

3. **Modify Genesis** (see examples above for each parameter)

4. **Configure app.toml**:

   - Set EVM chain ID
   - Configure mempool parameters
   - Configure JSON-RPC (for RPC nodes only)
   - Set minimum gas prices

5. **Launch**:

   ```bash
   yourchain start
   ```

## Complete Configuration Script Example

This script automates the entire setup process based on `local_node.sh`:

```bash
#!/bin/bash
# Complete chain setup script

BINARY="yourchain"
CHAIN_ID="yourchain-1"
MONIKER="my-node"
KEYRING="test"
DENOM="atoken"
GENESIS="$HOME/.yourchain/config/genesis.json"
TMP_GENESIS="$HOME/.yourchain/config/tmp_genesis.json"

# Initialize chain
$BINARY init $MONIKER --chain-id $CHAIN_ID

# Configure all denoms
jq ".app_state.staking.params.bond_denom=\"$DENOM\"" $GENESIS > $TMP_GENESIS && mv $TMP_GENESIS $GENESIS
jq ".app_state.gov.params.min_deposit[0].denom=\"$DENOM\"" $GENESIS > $TMP_GENESIS && mv $TMP_GENESIS $GENESIS
jq ".app_state.evm.params.evm_denom=\"$DENOM\"" $GENESIS > $TMP_GENESIS && mv $TMP_GENESIS $GENESIS
jq ".app_state.mint.params.mint_denom=\"$DENOM\"" $GENESIS > $TMP_GENESIS && mv $TMP_GENESIS $GENESIS

# Configure bank metadata (18 decimals)
jq ".app_state.bank.denom_metadata=[{
  description:\"The native token\",
  denom_units:[
    {denom:\"$DENOM\",exponent:0,aliases:[\"atto\"]},
    {denom:\"token\",exponent:18,aliases:[]}
  ],
  base:\"$DENOM\",
  display:\"token\",
  name:\"Token\",
  symbol:\"TKN\"
}]" $GENESIS > $TMP_GENESIS && mv $TMP_GENESIS $GENESIS

# Configure precompiles
jq '.app_state.evm.params.active_static_precompiles=[
  "0x0000000000000000000000000000000000000100",
  "0x0000000000000000000000000000000000000400",
  "0x0000000000000000000000000000000000000800"
]' $GENESIS > $TMP_GENESIS && mv $TMP_GENESIS $GENESIS

# Configure ERC20 module
jq '.app_state.erc20.native_precompiles=["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"]' $GENESIS > $TMP_GENESIS && mv $TMP_GENESIS $GENESIS
jq ".app_state.erc20.token_pairs=[{
  contract_owner:1,
  erc20_address:\"0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE\",
  denom:\"$DENOM\",
  enabled:true
}]" $GENESIS > $TMP_GENESIS && mv $TMP_GENESIS $GENESIS

# Configure consensus params
jq '.consensus.params.block.max_gas="10000000"' $GENESIS > $TMP_GENESIS && mv $TMP_GENESIS $GENESIS

echo "Genesis configuration complete!"
```

## Verification Commands

```bash
# Verify genesis is valid
yourchain genesis validate-genesis

# Check genesis hash
yourchain genesis hash ~/.yourchain/config/genesis.json

# Verify EVM chain ID
grep 'evm-chain-id' ~/.yourchain/config/app.toml

# Test node startup
yourchain start --log_level debug
```

**Last Updated**: Generated from cosmos/evm codebase (main branch)
**Codebase Version**: Cosmos SDK v0.53.4, IBC-Go v10, CometBFT v0.38.18
