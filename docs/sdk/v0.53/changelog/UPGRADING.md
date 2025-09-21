# Upgrading to Cosmos SDK v0.53

This document outlines the changes required when upgrading to Cosmos SDK v0.53.

## Migration to CometBFT

The most significant change in v0.53 is the migration from Tendermint to CometBFT.

### Breaking Changes

- **Import paths**: All Tendermint imports must be updated to CometBFT
- **Binary names**: Replace `tendermint` with `cometbft`
- **API changes**: Some Tendermint API calls have been updated

### Migration Steps

1. **Update Go dependencies**:
   ```bash
   go mod edit -replace github.com/tendermint/tendermint=github.com/cometbft/cometbft@v0.37.2
   go mod tidy
   ```

2. **Update import statements**:
   ```diff
   - import "github.com/tendermint/tendermint/abci/types"
   + import "github.com/cometbft/cometbft/abci/types"
   ```

3. **Update binary references** in Makefiles, scripts, and documentation

## Module Updates

### New Features

- **Enhanced governance**: Support for multiple choice proposals
- **Improved staking**: Better delegation and undelegation handling
- **Circuit breaker**: New safety mechanism for modules

### Deprecated Features

- Legacy amino encoding for transactions (use protobuf)
- Old REST endpoints (migrate to gRPC)

## API Changes

### Keeper Changes

- Several keeper constructors now require additional parameters
- Some keeper methods have updated signatures
- New dependency injection patterns

### Message Changes

- Some message types have been restructured
- New validation rules for certain transactions
- Enhanced error messages and codes

## Configuration Changes

### App Configuration

- New configuration options for mempool management
- Updated consensus parameters
- Enhanced logging configuration

### Client Configuration

- Updated client configuration for CometBFT compatibility
- New gRPC configuration options

## Testing Changes

- Updated test utilities for CometBFT
- New simulation test features
- Enhanced integration test framework

## Known Issues

- Some third-party tools may need updates for CometBFT compatibility
- Custom ABCI applications require careful migration
- Performance characteristics may differ slightly from Tendermint

For more detailed information, see the [Cosmos SDK v0.53 release notes](https://github.com/cosmos/cosmos-sdk/releases/tag/v0.53.0).