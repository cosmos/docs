# Build-a-Chain Documentation

This directory contains comprehensive documentation for teams building custom blockchains using Cosmos EVM.

## Files Overview

### Primary Guides

1. **[overview.mdx](./overview.mdx)** - Landing page with overview and navigation
   - Quick start cards
   - Key topics summary
   - Architecture decisions
   - Links to all resources

2. **[chain-customization-checklist.md](./chain-customization-checklist.md)** - Step-by-step checklist
   - 5 phases from pre-genesis to post-launch
   - Every item links to detailed documentation
   - Critical security warnings
   - Quick reference table

3. **[building-your-chain-guide.mdx](./building-your-chain-guide.mdx)** - Complete detailed guide
   - Full explanations of all concepts
   - Real code examples from codebase
   - Genesis configuration examples
   - Best practices and recommendations

### Reference Documentation

4. **[configuration-parameters.md](./configuration-parameters.md)** - All parameters reference
   - Chain initialization parameters
   - Genesis parameters
   - Runtime configuration
   - Governance-modifiable parameters

5. **[configuration-quick-reference.md](./configuration-quick-reference.md)** - Quick lookup
   - Most common scenarios
   - Quick examples
   - Launch checklist

6. **[token-configuration-guide.md](./token-configuration-guide.md)** - Token setup deep dive
   - 18-decimal vs 6-decimal tokens
   - Bank metadata configuration
   - Extended denom options
   - Common pitfalls

## Usage

### For New Chain Builders

1. Start with [overview.mdx](./overview.mdx) to understand the full scope
2. Follow [chain-customization-checklist.md](./chain-customization-checklist.md) step by step
3. Reference [building-your-chain-guide.mdx](./building-your-chain-guide.mdx) for details on each step

### For Experienced Developers

1. Use [configuration-quick-reference.md](./configuration-quick-reference.md) for quick lookups
2. Reference [configuration-parameters.md](./configuration-parameters.md) for complete parameter lists
3. Consult [token-configuration-guide.md](./token-configuration-guide.md) for decimal conversion details

## Link Structure

All internal documentation links use absolute paths:
```
/docs/evm/next/documentation/integration/build-a-chain/[filename]
```

External links:
- Node configuration: `/docs/evm/next/documentation/getting-started/node-configuration`
- GitHub source: `https://github.com/cosmos/evm`

## Verification

All code snippets and instructions have been verified against:
- `/Users/cordt/repos/evm` codebase
- `local_node.sh` working examples
- Actual genesis files from production testing

See `VERIFICATION_SUMMARY.md` in the source repository for complete audit details.

## Maintenance

When updating these docs:
1. Verify code snippets against latest codebase
2. Test all anchor links
3. Update genesis examples if `local_node.sh` changes
4. Keep absolute paths consistent with site structure
5. Remove file extensions from all links
