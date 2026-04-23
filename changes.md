# CosmJS Documentation Inaccuracies

Changes needed to align documentation with the actual source code in `cosmos/cosmjs`.

---

## `cosmjs/v0.38.x/api-reference/amino.mdx`

### 1. `makeSignDoc` missing `timeout_height` parameter

The table shows only 6 parameters but the actual source (`amino/src/signdoc.ts`) has a 7th optional parameter:

```typescript
// Source signature:
export function makeSignDoc(
  msgs: readonly AminoMsg[],
  fee: StdFee,
  chainId: string,
  memo: string | undefined,  // also accepts undefined, not just string
  accountNumber: number | string,
  sequence: number | string,
  timeout_height?: bigint,   // ← missing from docs
): StdSignDoc
```

**Fix:** Add `timeout_height?: bigint` as a 7th parameter in the table row for `makeSignDoc`. Also update `memo` type to `string | undefined`.

---

## `cosmjs/v0.38.x/api-reference/socket.mdx`

This file has the most inaccuracies. The public APIs differ from what is documented in multiple places.

### 2. `SocketWrapper.constructor` — `errorHandler` is required, not optional

The docs show `errorHandler?:` (optional) but the source (`socket/src/socketwrapper.ts:53-59`) has `errorHandler` as a required positional parameter (no `?`, no default):

```typescript
// Source:
public constructor(
  url: string,
  messageHandler: (event: SocketWrapperMessageEvent) => void,
  errorHandler: (event: SocketWrapperErrorEvent) => void,  // required
  openHandler?: () => void,
  closeHandler?: (event: SocketWrapperCloseEvent) => void,
  timeout = 10_000,  // missing from docs
)
```

**Fix:** Remove the `?` from `errorHandler` and add the `timeout = 10_000` parameter at the end.

### 3. `SocketWrapper.send` return type is wrong

Docs show `send(data: string)` returns `void`, but source (`socketwrapper.ts:161`) declares it `async send(data: string): Promise<void>`.

**Fix:** Change return type from `void` to `Promise<void>`.

### 4. `SocketWrapperErrorEvent` fields are optional, not required

The docs show:
```typescript
interface SocketWrapperErrorEvent {
  readonly message: string;  // required
  readonly type: string;     // required
}
```

But source (`socketwrapper.ts:17-24`) has both fields as optional:
```typescript
export interface SocketWrapperErrorEvent {
  readonly isTrusted?: boolean;  // also not in docs
  readonly type?: string;
  readonly message?: string;
}
```

**Fix:** Mark both `type` and `message` as optional (`type?: string`, `message?: string`). Also add the `isTrusted?: boolean` field.

### 5. `StreamingSocket.send` return type is wrong

Same issue as `SocketWrapper.send`. Source (`streamingsocket.ts:60`) declares it `async send(data: string): Promise<void>`.

**Fix:** Change return type from `void` to `Promise<void>`.

### 6. `QueueingStreamingSocket` — `send` method does not exist; it's `queueRequest`

The docs list a `send(data: string): void` method, but `QueueingStreamingSocket` has no `send()` method. Source (`queueingstreamingsocket.ts:98`) has `queueRequest(request: string): void`.

**Fix:** Replace `send(data: string): void` with `queueRequest(request: string): void` in the method table.

### 7. `QueueingStreamingSocket.constructor` missing `reconnectedHandler` parameter

Docs show `constructor(url: string, timeout?: number)` but source (`queueingstreamingsocket.ts:30`) has:
```typescript
public constructor(url: string, timeout = 10_000, reconnectedHandler?: () => void)
```

**Fix:** Add `reconnectedHandler?: () => void` as the third constructor parameter.

### 8. `ReconnectingSocket.constructor` — wrong parameters

Docs show:
```
constructor(url: string, reconnectInterval?: number, timeout?: number)
```

The source (`reconnectingsocket.ts:26`) has:
```typescript
public constructor(url: string, timeout = 10_000, reconnectedHandler?: () => void)
```

The `reconnectInterval` parameter **does not exist**. The backoff is computed internally with exponential logic (`Math.min(2 ** index * 100, 5_000)`), not via a config parameter.

**Fix:** Replace with the correct signature: `constructor(url: string, timeout?: number, reconnectedHandler?: () => void)`.

### 9. `ReconnectingSocket` — `send` method does not exist; it's `queueRequest`

Same issue as `QueueingStreamingSocket`. Source (`reconnectingsocket.ts:85`) has `queueRequest(request: string): void`, not `send()`.

**Fix:** Replace `send(data: string): void` with `queueRequest(request: string): void`.

---

## Summary

| File | Issue | Severity |
|------|-------|----------|
| `amino.mdx` | `makeSignDoc` missing `timeout_height?: bigint` parameter | Medium |
| `socket.mdx` | `SocketWrapper.constructor` errorHandler shown as optional (it's required), missing `timeout` param | High |
| `socket.mdx` | `SocketWrapper.send` return type: `void` → `Promise<void>` | High |
| `socket.mdx` | `SocketWrapperErrorEvent` fields shown as required; both are optional | Medium |
| `socket.mdx` | `StreamingSocket.send` return type: `void` → `Promise<void>` | High |
| `socket.mdx` | `QueueingStreamingSocket.send` doesn't exist; correct method is `queueRequest` | High |
| `socket.mdx` | `QueueingStreamingSocket.constructor` missing `reconnectedHandler` param | Medium |
| `socket.mdx` | `ReconnectingSocket.constructor` lists `reconnectInterval` which doesn't exist | High |
| `socket.mdx` | `ReconnectingSocket.send` doesn't exist; correct method is `queueRequest` | High |
