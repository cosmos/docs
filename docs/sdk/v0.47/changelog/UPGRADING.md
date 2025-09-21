# Upgrading to Cosmos SDK v0.47

This document outlines the changes required when upgrading to Cosmos SDK v0.47.

## Migration to CometBFT (Part 1)

Cosmos SDK v0.47 begins the migration from Tendermint to CometBFT. This is a multi-part transition.

### Breaking Changes

- **Import paths**: Begin updating Tendermint imports to CometBFT
- **Dependencies**: CometBFT replaces Tendermint Core
- **Configuration**: Some consensus parameters have changed

### Migration Steps

1. **Update Go dependencies**:
   ```bash
   go get github.com/cometbft/cometbft@v0.37.0
   go mod edit -replace github.com/tendermint/tendermint=github.com/cometbft/cometbft@v0.37.0
   go mod tidy
   ```

2. **Update import statements gradually**:
   ```diff
   - import "github.com/tendermint/tendermint/libs/log"
   + import "github.com/cometbft/cometbft/libs/log"
   ```

## Module Changes

### New Modules

- **Group**: Decentralized group management and decision making
- **NFT**: Basic NFT functionality
- **Consensus**: Consensus parameter management

### Updated Modules

- **Gov**: Enhanced governance with new features
- **Staking**: Improved validator and delegation handling
- **Auth**: Enhanced account types and features
- **Bank**: Multi-send improvements

### Module API Changes

- Several keeper interfaces have been updated
- New module manager patterns
- Enhanced inter-module communication

## Protobuf Changes

### gogoproto Migration

SDK v0.47 continues the migration away from gogoproto to standard protobuf.

```bash
# Update protobuf generation
make proto-gen
```

### Breaking Proto Changes

- Some message types have been restructured
- Field ordering may have changed
- New validation rules

## Configuration Changes

### App Configuration

- New configuration structure for some modules
- Updated genesis format for certain modules
- Enhanced node configuration options

### Client Configuration

- Updated client configuration patterns
- New gRPC configuration options
- Enhanced REST API configuration

## API Changes

### REST API

- Some REST endpoints have been updated or deprecated
- New gRPC-gateway endpoints
- Enhanced error responses

### gRPC

- New gRPC services for modules
- Updated query and message interfaces
- Enhanced streaming capabilities

## CLI Changes

- Updated command structure for some modules
- New CLI flags and options
- Enhanced output formatting

## Testing Changes

- Updated test utilities
- New simulation framework features
- Enhanced integration testing patterns

## Known Issues

### IBC Compatibility

Ensure your IBC-go version is compatible with SDK v0.47:
- Use IBC-go v7.x for SDK v0.47

### Third-party Dependencies

- Some third-party tools may need updates
- Custom modules may require interface updates
- Review all external dependencies

## Performance Improvements

- Optimized store operations
- Better memory management
- Enhanced caching

## Migration Checklist

- [ ] Update Go dependencies
- [ ] Update import statements
- [ ] Update keeper constructors
- [ ] Update module interfaces
- [ ] Update CLI commands
- [ ] Update tests
- [ ] Verify IBC compatibility
- [ ] Test application thoroughly

For more detailed information, see the [Cosmos SDK v0.47 release notes](https://github.com/cosmos/cosmos-sdk/releases/tag/v0.47.0).