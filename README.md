# Cosmos Documentation Hub

Welcome to the unified Documentation for the Cosmos stack.

This repository includes documentation for:

- [Cosmos SDK](/sdk/) - Modular framework for building secure, high-performance blockchains
- [Cosmos EVM](/evm/) - EVM compatibility layer with Solidity support and access to Cosmos SDK features
- [IBC Protocol](/ibc/) - Inter-Blockchain Communication protocol for secure cross-chain transfers and messaging
- [Comet BFT](/cometbft/) - Byzantine Fault Tolerant consensus engine achieving up to 10,000 TPS with instant finality
- [Cosmos Hub](/hub/) - The first interconnected blockchain in the Cosmos Network and home of the ATOM token

## Contributing

Please read the [Contributing Guidelines](./contributing.md) for more information on contribution policies.

> [!IMPORTANT]
> Previous versions will only be edited under specific circumstances. All external contributions should be within the 'next' directory.

### Fork the repository

- Click “Fork” in the GitHub UI to create your own copy.

### Clone your fork

```bash
   git clone https://github.com/<your-username>/cosmos-docs.git
   cd cosmos-docs
```

### Create a branch

```bash
   git checkout -b my-feature
```

### Make your changes

- Edit or add files under `<product>/next/` as needed (e.g., `sdk/next/`, `evm/next/`, `ibc/next/`)
- Follow existing file structure and naming conventions
- Ensure Markdown is valid and links resolve

### Local testing & validation

```bash
# Start a live-reload preview
npx mint dev

# Check for broken internal links
npx mint broken-links
```

### Commit and push

```bash
   git add .
   git commit -m "Brief description of your change"
   git push origin my-feature
```

### Open a Pull Request

- On GitHub, navigate to your fork.
- Click “Compare & pull request.”
- Provide a concise title and description.
- Submit the PR for review.




## Project Structure

- `<product>/next/` - Active development documentation (e.g., `sdk/next/`, `evm/next/`, `ibc/next/`, `hub/next/`)
- `<product>/<version>/` - Versioned documentation, by major release (e.g., `sdk/v0.53/`, `evm/v0.5.0/`, `hub/v25/`)
- `scripts/versioning/` - Versioning automation - see [README](/scripts/versioning/README.md)
- `scripts/migration/` - Docusaurus to Mintlify migration tools - see [migrate.js](scripts/migration/migrate.js)
- `assets/<product>/images/` - Static assets (images) for each product
- `snippets/` - Custom components - Due to platform limitations, components cannot be versioned. However, it is possible to feed specific / versioned data to a component through a prop in the import (see `evm/v0.4.x/documentation/evm-compatibility/eip-reference.mdx` for a working example)

## Migrating Documentation

To migrate documentation from Docusaurus to Mintlify format:

```bash
# Interactive mode (recommended - includes prompts for dry-run and staging)
cd scripts/migration
node migrate.js

# Non-interactive mode with options
node migrate.js <source-repo-path> <target-directory> <product-name> [options]

# Dry run - see what would be migrated without writing files
node migrate.js ~/repos/gaia ./hub hub --dry-run

# Staging mode - write to temp directory for review
node migrate.js ~/repos/gaia ./hub hub --staging

# Full migration with navigation updates
node migrate.js ~/repos/gaia ./hub hub --update-nav
```

> **Note:** The interactive mode will prompt you for dry-run and staging options, making it easy to test before running a full migration.

### Migration Options

- `--dry-run` - Process all files and show conversion results without writing any files. Use this to:

  - Preview what will be migrated
  - Check for conversion errors before committing
  - Validate the migration will work correctly

- `--staging` - Write files to `./tmp/migration-staging` instead of the target directory. Use this to:

  - Review converted files before copying to final location
  - Make manual adjustments if needed
  - Test the migration output

- `--update-nav` - Automatically update `docs.json` with navigation structure (not recommended with `--staging`)

### What the Migration Does

The migration script will:

- Convert Docusaurus MDX to Mintlify-compatible format
- Resolve all relative links (`./`, `../`, implicit) to absolute paths
- Copy static assets to `assets/<product>/images/`
- Fix internal links to use the new structure (`/<product>/<version>/...`)
- Remove numbered prefixes from file and directory names
- Convert Docusaurus admonitions to Mintlify callouts
- Generate proper frontmatter for Mintlify
- Report any conversion errors or warnings

