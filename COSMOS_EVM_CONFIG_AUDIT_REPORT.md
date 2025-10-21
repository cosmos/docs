# Cosmos EVM Configuration Documentation Audit Report

## Executive Summary

This audit reveals that while the configuration documentation contains mostly accurate file paths and line numbers, there are significant omissions, misleading information, and missing critical context that make the documentation difficult to use effectively. The documentation needs restructuring to better reflect the actual configuration workflow and include many missing configuration options.

## Audit Findings

### Pre-Genesis Configuration

#### ✅ Accurate Information

1. **Bech32 Address Prefix** (`config/config.go:62`)
   - Documentation correctly identifies the location
   - Actual code: `Bech32Prefix = "cosmos"` on line 62

2. **BIP44 Coin Type** (`crypto/hd/hdpath.go:9`)
   - Documentation correctly identifies the location
   - Actual code: `Bip44CoinType uint32 = 60` on line 9

3. **EVM Chain ID** (`config/config.go:78`)
   - Documentation correctly identifies the location
   - Actual code: `EVMChainID = 262144` on line 78

#### ❌ Issues and Omissions

1. **Chain Name Configuration**
   - Documentation suggests changing directory names and package names
   - Reality: The binary name is controlled by the build process and main.go, not directory names
   - Missing: Clear explanation that "evmd" is just an example implementation

2. **Token Decimal Precision**
   - Documentation mentions but doesn't clearly explain the decimal system
   - Missing: The complete decimal support (1-18 decimals) found in `x/vm/types/denom.go`
   - Missing: Explanation of conversion factors and how they work
   - Missing: PreciseBank module's role in handling 6-decimal tokens

3. **Default Denomination**
   - Documentation vaguely references multiple files
   - Reality: Defaults are in `x/vm/types/params.go` (lines 21-25)
   - Missing: Clear explanation of the three-tier denomination system (base, extended, display)

4. **Module Configuration**
   - Completely missing: Module account permissions configuration in `config/evmd_config.go`
   - Missing: Blocked addresses configuration
   - Missing: How to configure which modules to include

### Genesis Configuration

#### ❌ Critical Issues

1. **Precompiles Configuration**
   - Documentation shows enabling all precompiles with a simple list
   - Reality: Precompiles are defined in `x/vm/types/precompiles.go` with `AvailableStaticPrecompiles`
   - Missing: Precompile addresses and their specific purposes
   - Missing: How to selectively enable/disable precompiles
   - Missing: Security implications of enabling certain precompiles

2. **Fee Market Configuration**
   - Documentation mentions basic parameters
   - Missing: Default values from `x/feemarket/types/params.go`:
     - `DefaultBaseFee = 1_000_000_000`
     - `DefaultMinGasMultiplier = 0.5`
     - `BaseFeeChangeDenominator` from go-ethereum params
     - `ElasticityMultiplier` from go-ethereum params
   - Missing: Explanation of EIP-1559 implementation details

3. **Single Token Representation v2 (STRv2)**
   - Documentation mentions it exists
   - Missing: How to configure ERC20 module
   - Missing: Token pairs configuration
   - Missing: Contract owner settings

4. **Consensus Parameters**
   - Missing: Block size limits
   - Missing: Evidence parameters
   - Missing: Validator set updates

### Runtime and Launch Configuration

#### ❌ Critical Omissions

1. **Local Node Script**
   - Documentation doesn't reference the comprehensive `local_node.sh` script
   - Missing: All the configuration done in the script:
     - Chain ID configuration (line 3: `CHAINID="${CHAIN_ID:-9001}"`)
     - Keyring backend setup
     - Genesis modifications for denominations
     - Account funding
     - Validator setup

2. **App.toml Configuration**
   - Missing: EVM-specific configuration options
   - Missing: JSON-RPC configuration
   - Missing: TLS configuration
   - Missing: Mempool configuration

3. **Config.toml Configuration**
   - Missing: CometBFT specific settings
   - Missing: P2P configuration
   - Missing: Consensus timeouts

### Missing Sections Entirely

1. **Upgrade Handlers**
   - No mention of `evmd/upgrades.go`
   - No guidance on handling breaking changes

2. **IBC Configuration**
   - No mention of EVM channels configuration
   - Missing: IBC transfer module settings

3. **Access Control**
   - No documentation of the access control system for EVM
   - Missing: Create/Call permissions
   - Missing: Allowlist configuration

4. **History Serve Window**
   - Not mentioned but important for archive nodes
   - Default: 8192 blocks (same as EIP-2935)

5. **Extended Denom Options**
   - Not documented but present in the code
   - Important for token representation

## Recommendations

### 1. Restructure Documentation

Create three clear sections:
- **Pre-Compilation Configuration**: Code changes before building
- **Genesis Configuration**: Chain initialization parameters
- **Runtime Configuration**: Node operation settings

### 2. Add Missing Configuration Examples

Include complete examples for:
- Custom chain with 6-decimal token
- Permissioned EVM deployment
- Archive node configuration
- IBC-enabled EVM chain

### 3. Include Configuration Reference

Create a comprehensive table of all configuration parameters with:
- Parameter name
- File location
- Default value
- Description
- Example values
- Dependencies

### 4. Add Validation Checklist

Provide a checklist to verify configuration:
- [ ] Chain ID is unique
- [ ] Denomination is consistent across modules
- [ ] Precompiles don't conflict
- [ ] Fee market parameters are reasonable
- [ ] Genesis accounts are funded

### 5. Reference Actual Code

Update all file references to include:
- Exact file paths
- Line numbers (with version tags)
- Code snippets showing context

### 6. Include Migration Guide

Add section on migrating from:
- Ethereum to Cosmos EVM
- Previous Cosmos EVM versions
- Other Cosmos chains

### 7. Add Troubleshooting Section

Include common configuration errors:
- Mismatched decimals
- Invalid chain ID
- Missing precompiles
- Incorrect fee configuration

## Conclusion

While the documentation contains some accurate information, it is insufficient for users to successfully configure a Cosmos EVM chain. The missing information, particularly around precompiles, fee market, access control, and the actual configuration workflow, makes the documentation "unusable" as the user stated. A comprehensive rewrite focusing on completeness and practical examples is needed.

## Files Requiring Updates

1. `pre-genesis-and-genesis-setup.mdx` - Major revision needed
2. `runtime-and-launch.mdx` - Complete rewrite needed
3. New file needed: `configuration-reference.mdx`
4. New file needed: `configuration-examples.mdx`
5. New file needed: `troubleshooting-configuration.mdx`