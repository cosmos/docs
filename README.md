# Cosmos Documentation Hub

Documentation for all parts of the Cosmos Stack.

> [!NOTE]
> This is a work in progress. More components (IBC, CometBFT, etc) will be migrated in the near future.

## Project Structure

- `docs/<product>/next/` - Active development documentation
- `docs/<product>/<version>` - Versioned documentation, by major release.
- `scripts/versioning/` - Versioning automation - see [README](scripts/versioning/README.md).
- `snippets/` - Custom components - Due to platform limitations, components cannot be versioned. However, it is possible to feed specific / versioned data to a component through a prop in the import (see `docs/evm/v0.4.x/documentation/evm-compatibility/eip-reference.mdx` for a working example).

## Contributing

> [!IMPORTANT]
> Previous versions will only be edited under specific circumstances. All external contributions should be within the 'next' directory.

Fork the repository

- Click “Fork” in the GitHub UI to create your own copy.

Clone your fork

```bash
   git clone https://github.com/<your-username>/cosmos-docs.git
   cd cosmos-docs
```

Create a branch

```bash
   git checkout -b my-feature
```

Make your changes

- Edit or add files under `docs/next/` as needed.
- Follow existing file structure and naming conventions.
- Ensure Markdown is valid and links resolve.

Local testing & validation

```bash
# Start a live-reload preview
npx mint dev

# Check for broken internal links
npx mint broken-links
```

Commit and push

```bash
   git add .
   git commit -m "Brief description of your change"
   git push origin my-feature
```

Open a Pull Request

- On GitHub, navigate to your fork.
- Click “Compare & pull request.”
- Provide a concise title and description.
- Submit the PR for review.
