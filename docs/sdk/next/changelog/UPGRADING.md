# Upgrading Cosmos SDK

This document provides information on upgrading between versions of the Cosmos SDK.

## Migration to CometBFT

The Cosmos SDK has migrated from Tendermint to CometBFT. This is the most significant change affecting all applications.

### Breaking Changes

- **Package imports**: All Tendermint imports must be updated to CometBFT
- **Binary names**: `tendermint` binary is now `cometbft`
- **Configuration**: Some configuration parameters have changed

### Migration Steps

1. **Update imports** in your application code:
   ```diff
   - import "github.com/tendermint/tendermint/..."
   + import "github.com/cometbft/cometbft/..."
   ```

2. **Update dependencies** in go.mod:
   ```bash
   go mod edit -replace github.com/tendermint/tendermint=github.com/cometbft/cometbft@v0.37.x
   ```

3. **Update binary references** in scripts and documentation

4. **Review configuration changes** in your app configuration

### Additional Resources

- [CometBFT Migration Guide](https://docs.cometbft.com/v0.37/guides/migration)
- [Cosmos SDK Release Notes](/docs/sdk/next/changelog/release-notes)

## Module Changes

### New Modules

- **Circuit Breaker**: New module for emergency circuit breaking functionality
- **Protocol Pool**: Module for managing community pool funds

### Updated Modules

- **Gov**: Enhanced governance with multiple choice proposals
- **Staking**: Improved validator set management
- **Bank**: Enhanced multi-asset support

### Deprecated Features

- Legacy amino signing: Migrate to protobuf-based signing
- Legacy REST endpoints: Use gRPC or gRPC-gateway instead

## API Changes

### Breaking API Changes

- Several keeper interfaces have been updated
- Message types have been restructured for better extensibility
- Query responses now include additional metadata

### New APIs

- Enhanced ABCI 2.0 support
- Improved mempool interfaces
- Extended telemetry capabilities

## Testing Updates

- Test utilities have been enhanced
- New simulation framework features
- Improved integration test helpers

For detailed migration steps and examples, see the version-specific migration guides in the SDK repository.