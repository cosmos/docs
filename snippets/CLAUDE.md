# snippets/

Reusable MDX and JSX components imported across the documentation with Mintlify's `<Snippet>` system or direct JSX imports.

## Contents

| File | Purpose |
|------|---------|
| `blockchain-demo.jsx` | Animated interactive blockchain diagram used in intro/concepts pages |
| `code-highlighter.jsx` | Syntax-highlighted code block component |
| `cosmos-stack-diagram.jsx` | Visual diagram of the Cosmos stack layers |
| `cosmos-stack-learn.jsx` | Interactive version of the Cosmos stack diagram for learning pages |
| `doc-card.jsx` | Card component used for "next steps" or resource links |
| `docs-navigation-drawer.jsx` | Mobile navigation drawer component |
| `eip-compatibility-table.jsx` | EIP compatibility table for EVM docs (reads from Google Sheets data) |
| `footnote.mdx` | Reusable footnote/callout snippet |
| `icons.mdx` | Icon library — import and use named icons across MDX pages |
| `mobile-menu-drawer.jsx` | Mobile menu overlay component |
| `rpc-methods-viewer.jsx` | Interactive RPC method explorer component |
| `topic-card-component.jsx` | Card grid component for topic index pages |

## Important: No external package imports

Mintlify does **not** allow importing from external packages (e.g. `react`, `react-dom`) in snippets or MDX files. Doing so produces a warning:

```
warning - Invalid import path react in /snippets/foo.jsx. Only local imports are supported.
```

**React hooks (`useState`, `useEffect`, `useRef`, etc.) are provided automatically** by the Mintlify runtime — do not import them. Only local file imports (relative paths like `./other-component.jsx`) are allowed.
