# Upgrading to Cosmos SDK v0.50

This document outlines the changes required when upgrading to Cosmos SDK v0.50.

## Major Changes

### AutoCLI Integration

v0.50 introduces AutoCLI as a core feature for automatic CLI generation.

### New Modules

- **Circuit Breaker**: Emergency circuit breaking functionality
- **Epochs**: Time-based epoch management
- **NFT**: Native NFT support
- **Protocol Pool**: Community pool management

### Module Updates

- **Gov**: Enhanced governance with new proposal types
- **Staking**: Improved validator management
- **Auth**: Enhanced account management
- **Bank**: Multi-asset improvements

## Breaking Changes

### API Changes

- Several keeper interfaces have been updated
- New dependency injection patterns
- Enhanced ABCI integration

### Configuration Changes

- New app configuration structure
- Enhanced client configuration
- Updated genesis format

## Migration Steps

### 1. Update Dependencies

```bash
go get github.com/cosmos/cosmos-sdk@v0.50.x
go mod tidy
```

### 2. Update Imports

Update any changed package paths in your application code.

### 3. Update App Configuration

- Review and update your app.go file
- Update keeper constructors with new parameters
- Implement new module interfaces if using custom modules

### 4. Update CLI Commands

- Leverage AutoCLI for automatic command generation
- Update custom CLI commands if needed

### 5. Update Tests

- Update test utilities usage
- Review simulation test configurations
- Update integration test patterns

## New Features

### AutoCLI

AutoCLI automatically generates CLI commands based on your module's query and transaction services.

```go
// Enable AutoCLI in your module
func (am AppModule) AutoCLIOptions() *autocliv1.ModuleOptions {
    return &autocliv1.ModuleOptions{
        Query: &autocliv1.ServiceCommandDescriptor{
            Service: bankv1beta1.Query_ServiceDesc.ServiceName,
        },
        Tx: &autocliv1.ServiceCommandDescriptor{
            Service: bankv1beta1.Msg_ServiceDesc.ServiceName,
        },
    }
}
```

### Dependency Injection

Enhanced dependency injection patterns for cleaner module architecture.

### Enhanced ABCI

Improved ABCI integration with better error handling and performance.

## Deprecated Features

- Legacy amino encoding (migrate to protobuf)
- Old REST endpoints (use gRPC or gRPC-gateway)
- Legacy CLI patterns (migrate to AutoCLI)

## Testing Changes

- Enhanced simulation framework
- New integration test utilities
- Improved mock generation

## Performance Improvements

- Optimized state machine execution
- Better memory management
- Enhanced caching mechanisms

For detailed migration examples and additional information, see the [Cosmos SDK v0.50 release notes](https://github.com/cosmos/cosmos-sdk/releases/tag/v0.50.0).