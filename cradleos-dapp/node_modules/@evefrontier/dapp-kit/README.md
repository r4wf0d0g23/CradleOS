# @evefrontier/dapp-kit

React SDK for building EVE Frontier dApps on the Sui blockchain.

**Full API documentation (TypeDoc): [http://sui-docs.evefrontier.com/](http://sui-docs.evefrontier.com/)**

## Install

```bash
pnpm add @evefrontier/dapp-kit
# peer deps
pnpm add @tanstack/react-query react
```

> Keep your app’s versions of **react**, **@mysten/dapp-kit-react**, and **@mysten/sui** in sync with the versions used by this package to avoid type or runtime mismatches. Check `package.json` for the current ranges.

## Quick start

1. Wrap your app with `EveFrontierProvider` (requires a `QueryClient`).
2. Use `useConnection`, `useSmartObject`, `useNotification`, and `useSponsoredTransaction` as needed.

```tsx
import { EveFrontierProvider, useConnection, useSmartObject } from "@evefrontier/dapp-kit";
import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
  return (
    <EveFrontierProvider queryClient={queryClient}>
      <MyDapp />
    </EveFrontierProvider>
  );
}

function MyDapp() {
  const { isConnected, handleConnect } = useConnection();
  const { assembly, loading } = useSmartObject();
  if (!isConnected) return <button onClick={handleConnect}>Connect</button>;
  if (loading) return <div>Loading...</div>;
  return <div>{assembly?.name}</div>;
}
```

Configure assembly via env (`VITE_OBJECT_ID`, as Sui Object ID) or URL (`?itemId=...&tenant=...`, derived).

Install the package once; then import only what you need via subpaths.

| Subpath | Use when you need |
|--------|--------------------|
| `@evefrontier/dapp-kit` | Default: providers, hooks, types, utils |
| `@evefrontier/dapp-kit/graphql` | GraphQL client, queries, and response types |
| `@evefrontier/dapp-kit/types` | Type definitions only |
| `@evefrontier/dapp-kit/utils` | Utilities (parsing, transforms, config) |
| `@evefrontier/dapp-kit/hooks` | Hooks only |
| `@evefrontier/dapp-kit/providers` | Providers only |
| `@evefrontier/dapp-kit/config` | Config / dApp kit setup |
  

## More

Hooks, types, GraphQL helpers, utilities, and wallet APIs are documented at **[http://sui-docs.evefrontier.com/](http://sui-docs.evefrontier.com/)**.

## License

MIT
