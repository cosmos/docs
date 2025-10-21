# Cosmos EVM Configuration Documentation - Corrected Understanding

## The Fundamental Issue

The current documentation incorrectly instructs users to modify core module code in the `github.com/cosmos/evm` repository. This is wrong. Users should:

1. **Import the evm modules** as dependencies (don't modify them)
2. **Create their own application** using `evmd` as a template/example
3. **Configure through standard Cosmos SDK methods** (genesis, config files, app construction)

## Correct Configuration Approach

### 1. Creating Your Own Chain Application

**What the docs say:** Modify files in `config/`, `crypto/hd/`, etc.

**What you should actually do:**

```bash
# 1. Create your own application directory
mkdir mychain
cd mychain

# 2. Copy evmd as a template
cp -r $GOPATH/src/github.com/cosmos/evm/evmd/* .

# 3. Rename and customize
# - Rename package from "evmd" to "mychain"
# - Update import paths
# - Modify app.go to configure your chain
```

### 2. Pre-Build Configuration (Your App Code)

These changes should be made in **YOUR** application code, not the evm module:

#### Chain Identity
```go
// mychain/cmd/mychaind/main.go
func main() {
    setupSDKConfig()
    rootCmd := cmd.NewRootCmd()
    if err := svrcmd.Execute(rootCmd, "mychaind", config.MustGetDefaultNodeHome()); err != nil {
        // ...
    }
}

func setupSDKConfig() {
    cfg := sdk.GetConfig()
    // Set YOUR chain's bech32 prefix
    cfg.SetBech32PrefixForAccount("mychain", "mychainpub")
    cfg.SetBech32PrefixForValidator("mychainvaloper", "mychainvaloperpub")
    cfg.SetBech32PrefixForConsensusNode("mychainvalcons", "mychainvalconspub")
    cfg.Seal()
}
```

#### Module Selection and Configuration
```go
// mychain/app.go
func NewApp(...) *App {
    // Configure which modules to include
    // Configure module account permissions
    // Set up custom precompiles
    // Configure ante handlers

    // Example: Select specific precompiles
    precompiles := NewAvailableStaticPrecompiles(
        ctx,
        app.StakingKeeper,
        app.DistributionKeeper,
        app.BankKeeper,
        app.Erc20Keeper,
        app.AuthzKeeper,
        app.TransferKeeper,
        app.IBCKeeper.ChannelKeeper,
        // Only include the precompiles you want
        precompile.WithStaking(),
        precompile.WithDistribution(),
        precompile.WithICS20(),
        // Don't include: WithBech32(), WithP256(), etc.
    )
}
```

### 3. Genesis Configuration

**Correct approach:** Modify genesis.json after initialization, don't change module code

```bash
# Initialize your chain
mychaind init mymoniker --chain-id mychain-1

# Modify genesis.json
cat genesis.json | jq '.app_state["evm"]["params"]["evm_denom"]="umycoin"' > tmp && mv tmp genesis.json
cat genesis.json | jq '.app_state["evm"]["params"]["active_static_precompiles"]=["0x0000000000000000000000000000000000000800","0x0000000000000000000000000000000000000801"]' > tmp && mv tmp genesis.json
cat genesis.json | jq '.app_state["feemarket"]["params"]["base_fee"]="1000000000"' > tmp && mv tmp genesis.json
```

Or programmatically in your app's `DefaultGenesis()`:

```go
// mychain/genesis.go
func DefaultGenesis() map[string]json.RawMessage {
    genesis := evmd.ModuleBasics.DefaultGenesis(cdc)

    // Customize EVM parameters
    var evmGenState evmtypes.GenesisState
    cdc.MustUnmarshalJSON(genesis[evmtypes.ModuleName], &evmGenState)
    evmGenState.Params.EvmDenom = "umycoin"
    evmGenState.Params.ActiveStaticPrecompiles = []string{
        precompiles.StakingAddress,
        precompiles.DistributionAddress,
    }
    genesis[evmtypes.ModuleName] = cdc.MustMarshalJSON(&evmGenState)

    // Customize fee market
    var feeGenState feemarkettypes.GenesisState
    cdc.MustUnmarshalJSON(genesis[feemarkettypes.ModuleName], &feeGenState)
    feeGenState.Params.BaseFee = math.LegacyNewDec(100_000_000)
    feeGenState.Params.MinGasPrice = math.LegacyNewDec(10_000_000)
    genesis[feemarkettypes.ModuleName] = cdc.MustMarshalJSON(&feeGenState)

    return genesis
}
```

### 4. Runtime Configuration

#### app.toml
```toml
# EVM Configuration
[evm]
# HTTP-RPC address
http-address = "0.0.0.0:8545"
# WebSocket address
ws-address = "0.0.0.0:8546"
# API namespaces
api = "eth,net,web3,txpool,debug"
# Block gas limit
block-gas-limit = "30000000"
# EVM chain ID (overrides genesis if set)
evm-chain-id = 9001

[json-rpc]
# Enable JSON-RPC server
enable = true
# API namespaces
api = "eth,net,web3"
# Gas cap
gas-cap = 50000000
# EVM timeout
evm-timeout = "5s"
# TX fee cap
tx-fee-cap = 1
```

#### config.toml (CometBFT)
```toml
# Standard CometBFT configuration
[consensus]
timeout_propose = "3s"
timeout_prevote = "1s"
timeout_precommit = "1s"
timeout_commit = "2s"
```

### 5. What NOT to Modify

Never modify these files in the `github.com/cosmos/evm` repository:
- ❌ `config/config.go` - Use your own config package
- ❌ `crypto/hd/hdpath.go` - This is standard Ethereum HD path
- ❌ `x/vm/types/params.go` - Override in genesis/app.go
- ❌ `x/feemarket/types/params.go` - Override in genesis/app.go
- ❌ Any core module code

## Correct Documentation Structure

The documentation should be restructured as:

### 1. Quick Start Guide
```markdown
1. Install dependencies
2. Clone evmd as template: `cp -r .../evmd mychain`
3. Customize app.go
4. Build: `make install`
5. Initialize: `mychaind init`
6. Configure genesis.json
7. Start: `mychaind start`
```

### 2. Application Development
- How to structure your app
- Importing evm modules
- Configuring module manager
- Setting up ante handlers
- Custom precompiles

### 3. Configuration Reference
- Genesis parameters (modifiable)
- App.toml settings
- Config.toml settings
- Environment variables

### 4. Advanced Customization
- Writing custom precompiles
- Extending modules
- Upgrade handlers
- IBC integration

## Example: Complete Custom Chain

```bash
# 1. Create your chain app (not modifying evm module)
mkdir ~/mychain && cd ~/mychain
go mod init github.com/myorg/mychain
go get github.com/cosmos/evm@latest

# 2. Copy evmd as template
cp -r $GOPATH/pkg/mod/github.com/cosmos/evm@*/evmd/* .

# 3. Update imports and package names
find . -type f -name "*.go" -exec sed -i 's/package evmd/package mychain/g' {} \;
find . -type f -name "*.go" -exec sed -i 's|github.com/cosmos/evm/evmd|github.com/myorg/mychain|g' {} \;

# 4. Customize your app.go
# - Set your chain's denomination
# - Choose your precompiles
# - Configure your modules

# 5. Build
make build

# 6. Initialize
./build/mychaind init mynode --chain-id mychain-1

# 7. Configure genesis
# Edit ~/.mychain/config/genesis.json

# 8. Start
./build/mychaind start
```

## Key Takeaways

1. **evmd is an EXAMPLE** - Copy it, don't modify the evm module
2. **Configuration happens in YOUR app** - Not in the core modules
3. **Genesis and config files** - Primary way to configure behavior
4. **Import modules as libraries** - Don't edit library code

The current documentation completely misses this architecture and incorrectly tells users to modify library code instead of creating their own application.