# Inkd Protocol — API Reference

Complete reference for `@inkd/sdk`. The SDK wraps the Inkd Protocol smart contracts on Base — a permanent, on-chain project registry designed for AI agents and developers.

> **Protocol model:** Lock 1 `$INKD` → register a project → push versions to Arweave → own it forever on-chain.

---

## Table of Contents

- [InkdClient](#inkdclient)
- [ADDRESSES](#addresses)
- [Event Subscriptions](#event-subscriptions)
- [Multicall Batch Reads](#multicall-batch-reads)
- [ArweaveClient](#arweaveclient)
- [Encryption](#encryption)
- [Errors](#errors)
- [Types](#types)

---

## InkdClient

Main SDK client. Wraps `InkdRegistry` (project creation, versioning, transfers) and `InkdToken` ($INKD allowance helpers).

### Constructor

```typescript
import { InkdClient } from "@inkd/sdk";

const inkd = new InkdClient(opts: InkdClientOptions);
```

### `InkdClientOptions`

```typescript
interface InkdClientOptions {
  walletClient: WalletClient;   // viem WalletClient (connected to Base / Base Sepolia)
  network?: "mainnet" | "testnet"; // default: "testnet"
  rpcUrl?: string;              // optional custom RPC URL
}
```

**Example — Base Sepolia (testnet):**

```typescript
import { InkdClient } from "@inkd/sdk";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

const inkd = new InkdClient({ walletClient, network: "testnet" });
```

**Custom RPC:**

```typescript
const inkd = new InkdClient({
  walletClient,
  network: "testnet",
  rpcUrl: "https://base-sepolia.g.alchemy.com/v2/YOUR_KEY",
});
```

---

### Token Helpers

#### `approveToken(amount?): Promise<Hash>`

Approve `InkdRegistry` to spend `$INKD` from the connected wallet. Required before `createProject`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `amount` | `bigint` | `parseEther("1")` | Amount in wei to approve |

```typescript
// Approve exactly 1 $INKD (default — enough for one project)
const txHash = await inkd.approveToken();

// Approve 10 $INKD (for multiple projects)
import { parseEther } from "viem";
const txHash = await inkd.approveToken(parseEther("10"));
```

#### `tokenBalance(address?): Promise<bigint>`

Get the `$INKD` balance of an address (wei).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `address` | `Address?` | connected wallet | Address to query |

```typescript
const balance = await inkd.tokenBalance();
// e.g. 5000000000000000000n  →  5 $INKD

const other = await inkd.tokenBalance("0xSomeAddress");
```

---

### Project Operations

#### `createProject(opts): Promise<Hash>`

Register a new project on-chain. Locks 1 `$INKD` token (must call `approveToken` first).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `opts.name` | `string` | ✅ | Project name |
| `opts.description` | `string` | ✅ | Short description |
| `opts.license` | `string` | — | SPDX identifier (default: `"MIT"`) |
| `opts.readmeHash` | `string` | — | Arweave hash of README (default: `""`) |
| `opts.isPublic` | `boolean` | — | Public visibility (default: `true`) |
| `opts.isAgent` | `boolean` | — | Mark as an AI agent project (default: `false`) |
| `opts.agentEndpoint` | `string` | — | Agent HTTP endpoint URL (default: `""`) |

**Returns:** Transaction hash. Use `waitForTransactionReceipt` to get the emitted `projectId`.

```typescript
const hash = await inkd.createProject({
  name: "my-agent",
  description: "An autonomous agent for on-chain tasks",
  license: "MIT",
  isPublic: true,
  isAgent: true,
  agentEndpoint: "https://my-agent.example.com",
});
```

#### `pushVersion(projectId, opts): Promise<Hash>`

Push a new version to an existing project. Pays the `versionFee` (0.001 ETH on testnet) automatically.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | `bigint` | ✅ | ID of the project |
| `opts.arweaveHash` | `string` | ✅ | Arweave transaction hash of the artifact |
| `opts.versionTag` | `string` | ✅ | Version label, e.g. `"v1.2.0"` |
| `opts.changelog` | `string` | — | Human-readable changelog (default: `""`) |

```typescript
const hash = await inkd.pushVersion(42n, {
  arweaveHash: "abc123ArweaveTxId",
  versionTag: "v0.9.0",
  changelog: "Improved reasoning loop, fixed rate limiting",
});
```

#### `getProject(projectId): Promise<ProjectStruct>`

Read project data from the registry.

```typescript
const project = await inkd.getProject(42n);
// {
//   id: 42n,
//   name: "my-agent",
//   description: "...",
//   license: "MIT",
//   readmeHash: "abc123...",
//   agentEndpoint: "https://my-agent.example.com",
//   owner: "0x...",
//   isAgent: true,
//   isPublic: true,
//   createdAt: 1709251200n,
//   versionCount: 3n,
//   exists: true,
// }
```

#### `getVersions(projectId): Promise<VersionStruct[]>`

Get all versions pushed to a project, ordered oldest-first.

```typescript
const versions = await inkd.getVersions(42n);
// [{
//   projectId: 42n,
//   arweaveHash: "abc123...",
//   versionTag: "v0.9.0",
//   changelog: "Initial release",
//   pushedBy: "0x...",
//   pushedAt: 1709251200n,
// }, ...]
```

#### `getVersionFee(): Promise<bigint>`

Fetch the current `versionFee` in wei from the registry.

```typescript
const fee = await inkd.getVersionFee();
// 1000000000000000n  →  0.001 ETH
```

#### `transferProject(projectId, newOwner): Promise<Hash>`

Transfer project ownership to a new address. Pays the `transferFee` (0.005 ETH on testnet) automatically.

| Parameter | Type | Description |
|-----------|------|-------------|
| `projectId` | `bigint` | Project to transfer |
| `newOwner` | `Address` | New owner wallet address |

```typescript
const hash = await inkd.transferProject(42n, "0xNewOwnerAddress");
```

#### `getAgentProjects(offset?, limit?): Promise<readonly bigint[]>`

Enumerate all projects marked as `isAgent: true`. Supports pagination.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `offset` | `bigint` | `0n` | Skip this many results |
| `limit` | `bigint` | `100n` | Max results to return |

```typescript
// First page
const ids = await inkd.getAgentProjects();

// Page 2 (100 per page)
const page2 = await inkd.getAgentProjects(100n, 100n);
```

---

## ADDRESSES

Exported constant with deployed contract addresses. Populated post-deploy.

```typescript
import { ADDRESSES } from "@inkd/sdk";

// {
//   mainnet: { token: "0x...", registry: "0x...", treasury: "0x..." },
//   testnet: { token: "0x...", registry: "0x...", treasury: "0x..." },
// }
console.log(ADDRESSES.testnet.registry);
```

> **Note:** Addresses are set at deployment. Check `DEPLOYED.md` in the repo root for the latest values after each deploy.

---

## Event Subscriptions

Real-time subscriptions to on-chain events via viem's `watchContractEvent`. Polls `getLogs` on an interval (default 4 s on public RPCs).

```typescript
import { watchProjectCreated, watchVersionPushed, watchRegistryEvents } from "@inkd/sdk";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
const REGISTRY = "0xYourRegistryAddress";
```

### `watchProjectCreated(publicClient, registryAddress, onEvent, filter?): Unwatch`

Subscribe to `ProjectCreated` events.

| Parameter | Type | Description |
|-----------|------|-------------|
| `publicClient` | `PublicClient` | viem public client |
| `registryAddress` | `Address` | InkdRegistry address |
| `onEvent` | `(e: ProjectCreatedEvent) => void` | Callback |
| `filter?.owner` | `Address?` | Only events from this owner |

```typescript
const unwatch = watchProjectCreated(publicClient, REGISTRY, (event) => {
  console.log("New project:", event.projectId, event.name, "by", event.owner);
});

// Filter to a specific owner
const unwatch2 = watchProjectCreated(
  publicClient, REGISTRY,
  (e) => console.log(e),
  { owner: "0xMyAddress" }
);

unwatch(); // Stop watching
```

**`ProjectCreatedEvent`:**

```typescript
interface ProjectCreatedEvent {
  projectId: bigint;
  owner: Address;
  name: string;
  license: string;
  _log: unknown; // raw viem log (block, txHash, logIndex, etc.)
}
```

---

### `watchVersionPushed(publicClient, registryAddress, onEvent, filter?): Unwatch`

Subscribe to `VersionPushed` events.

| Parameter | Type | Description |
|-----------|------|-------------|
| `filter?.projectId` | `bigint?` | Only versions for this project |

```typescript
const unwatch = watchVersionPushed(publicClient, REGISTRY, (event) => {
  console.log("Version:", event.versionTag, "→", event.arweaveHash);
}, { projectId: 42n });
```

**`VersionPushedEvent`:**

```typescript
interface VersionPushedEvent {
  projectId: bigint;
  arweaveHash: string;
  versionTag: string;
  pushedBy: Address;
  _log: unknown;
}
```

---

### `watchRegistryEvents(publicClient, registryAddress, handlers): { unwatchAll }`

Watch both event types in one call. Only sets up the watchers whose handlers are provided.

```typescript
const { unwatchAll } = watchRegistryEvents(publicClient, REGISTRY, {
  onProjectCreated: (e) => console.log("Created:", e.name),
  onVersionPushed:  (e) => console.log("Version:", e.versionTag),
  // Optional per-event filters:
  projectCreatedFilter: { owner: "0x..." },
  versionPushedFilter:  { projectId: 42n },
});

unwatchAll(); // Stop both
```

---

### `Unwatch`

```typescript
type Unwatch = () => void;
```

---

## Multicall Batch Reads

Fetch multiple projects or versions in a single RPC round-trip using Multicall3 (`0xcA11bde05977b3631167028862bE2a173976CA11`, deployed on Base and Base Sepolia).

```typescript
import { batchGetProjects, batchGetVersions, batchGetFees, batchGetProjectsWithVersions } from "@inkd/sdk";
```

### `batchGetProjects(publicClient, registryAddress, projectIds): Promise<BatchResult<ProjectData>[]>`

Fetch multiple projects in one call.

```typescript
const results = await batchGetProjects(publicClient, REGISTRY, [1n, 2n, 3n]);

for (const r of results) {
  if (r.success) {
    console.log(r.data.name, r.data.owner);
  } else {
    console.warn("Failed:", r.error);
  }
}
```

### `batchGetVersions(publicClient, registryAddress, projectIds): Promise<BatchResult<VersionData[]>[]>`

Fetch all versions for multiple projects in one call.

```typescript
const results = await batchGetVersions(publicClient, REGISTRY, [1n, 2n]);
// results[0].data  →  VersionData[] for project 1
// results[1].data  →  VersionData[] for project 2
```

### `batchGetFees(publicClient, registryAddress): Promise<RegistryFees>`

Fetch `versionFee`, `transferFee`, and `tokenLockAmount` in one multicall.

```typescript
const fees = await batchGetFees(publicClient, REGISTRY);
// {
//   versionFee: 1000000000000000n,    // 0.001 ETH
//   transferFee: 5000000000000000n,   // 0.005 ETH
//   tokenLockAmount: 1000000000000000000n, // 1 $INKD
// }
```

### `batchGetProjectsWithVersions(publicClient, registryAddress, projectIds): Promise<{ project, versions }[]>`

Fetch full project structs **and** their version arrays together.

```typescript
const data = await batchGetProjectsWithVersions(publicClient, REGISTRY, [1n, 2n]);
// data[0].project  →  ProjectData
// data[0].versions →  VersionData[]
```

---

### Batch Types

```typescript
interface BatchResult<T> {
  data: T | null;    // Decoded value, or null if call reverted
  success: boolean;
  error?: string;    // Revert reason if success === false
}

interface ProjectData {
  id: bigint;
  name: string;
  description: string;
  license: string;
  readmeHash: string;
  owner: Address;
  isPublic: boolean;
  isAgent: boolean;
  agentEndpoint: string;
  createdAt: bigint;
  versionCount: bigint;
  exists: boolean;
}

interface VersionData {
  projectId: bigint;
  arweaveHash: string;
  versionTag: string;
  changelog: string;
  pushedBy: Address;
  pushedAt: bigint;
}

interface RegistryFees {
  versionFee: bigint;      // wei per version push
  transferFee: bigint;     // wei per transfer
  tokenLockAmount: bigint; // $INKD locked per project
}
```

---

## ArweaveClient

Direct Arweave storage via [Irys](https://irys.xyz). Used for uploading artifacts before calling `pushVersion`.

> **Peer dependency:** `@irys/sdk` must be installed separately. It is lazily imported on first `connect()` call.

### Constructor

```typescript
import { ArweaveClient } from "@inkd/sdk";

const arweave = new ArweaveClient(
  irysUrl: string,       // e.g. "https://node2.irys.xyz"
  privateKey: string,    // Ethereum private key (0x...)
  gateway?: string       // default: "https://arweave.net"
);
```

### Methods

#### `connect(): Promise<void>`

Initialize the Irys client. Must be called before any upload.

```typescript
await arweave.connect();
```

#### `uploadFile(data, contentType, tags?): Promise<UploadResult>`

Upload data to Arweave via Irys.

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `Buffer \| Uint8Array` | File bytes |
| `contentType` | `string` | MIME type (e.g. `"application/json"`) |
| `tags` | `Record<string, string>?` | Optional Arweave tags |

**Returns:** `{ hash: string, url: string, size: number }`

```typescript
const result = await arweave.uploadFile(
  Buffer.from(JSON.stringify({ version: "v0.9.0" })),
  "application/json",
  { "App-Name": "inkd-protocol" }
);
// result.hash  →  use as arweaveHash in pushVersion()
// result.url   →  "https://arweave.net/<hash>"
```

`uploadData()` is an alias for `uploadFile()`.

#### `downloadData(hash): Promise<Buffer>`

Download data from Arweave by transaction hash.

```typescript
const buf = await arweave.downloadData("abc123...");
const json = JSON.parse(buf.toString("utf-8"));
```

`getFile()` is an alias for `downloadData()`.

#### `getUrl(hash): string`

Get the full gateway URL for an Arweave hash (synchronous).

```typescript
const url = arweave.getUrl("abc123...");
// "https://arweave.net/abc123..."
```

#### `getUploadPrice(bytes): Promise<bigint>`

Estimate the Irys upload price in atomic units for a given file size.

```typescript
const price = await arweave.getUploadPrice(1024 * 1024); // 1 MB
```

#### `uploadEncrypted(data, contentType, encrypt): Promise<UploadResult>`

Upload encrypted data. Accepts a custom encrypt function.

```typescript
const result = await arweave.uploadEncrypted(
  rawData,
  "application/octet-stream",
  async (data) => myEncrypt(data)
);
```

---

## Encryption

Pluggable encryption for Arweave-stored data. V1 ships with passthrough (no encryption). V2 adds Lit Protocol token-gating.

### `IEncryptionProvider`

```typescript
interface IEncryptionProvider {
  encrypt(
    data: Uint8Array,
    tokenId: bigint,
    contractAddress: Address
  ): Promise<EncryptedData>;

  decrypt(
    encryptedData: EncryptedData,
    tokenId: bigint,
    contractAddress: Address
  ): Promise<Uint8Array>;
}
```

### `PassthroughEncryption` (V1 default)

Stores data unencrypted on Arweave. No configuration required.

```typescript
import { PassthroughEncryption } from "@inkd/sdk";

const encryption = new PassthroughEncryption();
// Data round-trips unchanged
```

### `LitEncryptionProvider` (V2 — Lit Protocol)

Encrypts data so only the ERC-721 InkdToken owner can decrypt it via Lit Protocol access control conditions.

```typescript
import { LitEncryptionProvider } from "@inkd/sdk";

const encryption = new LitEncryptionProvider({ network: "datil", chain: "base" });
await encryption.connect();

inkd.setEncryptionProvider(encryption);
```

> **Note:** `LitEncryptionProvider` is a stub in the current SDK. Full Lit Protocol integration ships in V2.

---

## Errors

All errors extend `InkdError` with a `.code` string field.

```typescript
import { InkdError, ClientNotConnected, UploadError } from "@inkd/sdk";
```

| Error class | Code | Thrown when |
|-------------|------|-------------|
| `ClientNotConnected` | `CLIENT_NOT_CONNECTED` | `walletClient` not connected |
| `ArweaveNotConnected` | `ARWEAVE_NOT_CONNECTED` | `ArweaveClient.connect()` not called |
| `TransactionFailed` | `TRANSACTION_FAILED` | On-chain TX reverted |
| `InsufficientFunds` | `INSUFFICIENT_FUNDS` | Not enough ETH for fees |
| `UploadError` | `UPLOAD_ERROR` | Arweave/Irys upload failed |
| `EncryptionError` | `ENCRYPTION_ERROR` | Encryption/decryption failed |
| `NotInkdHolder` | `NOT_INKD_HOLDER` | Address holds no InkdToken (legacy) |
| `TokenNotFound` | `TOKEN_NOT_FOUND` | Token ID doesn't exist (legacy) |
| `InscriptionNotFound` | `INSCRIPTION_NOT_FOUND` | Inscription index out of range (legacy) |
| `NotTokenOwner` | `NOT_TOKEN_OWNER` | Caller is not the token owner (legacy) |
| `MaxSupplyReached` | `MAX_SUPPLY_REACHED` | 10,000 token cap hit (legacy) |

```typescript
import { UploadError, TransactionFailed } from "@inkd/sdk";

try {
  await inkd.pushVersion(42n, { arweaveHash: "...", versionTag: "v1.0.0" });
} catch (e) {
  if (e instanceof TransactionFailed) {
    console.error("TX reverted:", e.message, e.txHash);
  } else if (e instanceof UploadError) {
    console.error("Arweave upload failed:", e.message);
  }
}
```

**`TransactionFailed` extras:**

```typescript
class TransactionFailed extends InkdError {
  txHash?: string; // transaction hash if available
}
```

**`InsufficientFunds` extras:**

```typescript
class InsufficientFunds extends InkdError {
  required: bigint;
  available: bigint;
}
```

---

## Types

### `Address`

```typescript
type Address = `0x${string}`;
```

### `ContentType`

Common MIME types as an enum for convenience:

```typescript
enum ContentType {
  JSON        = "application/json",
  PlainText   = "text/plain",
  Markdown    = "text/markdown",
  HTML        = "text/html",
  CSS         = "text/css",
  JavaScript  = "application/javascript",
  TypeScript  = "application/typescript",
  PNG         = "image/png",
  JPEG        = "image/jpeg",
  SVG         = "image/svg+xml",
  GIF         = "image/gif",
  WebP        = "image/webp",
  PDF         = "application/pdf",
  Binary      = "application/octet-stream",
  YAML        = "application/yaml",
  XML         = "application/xml",
  CSV         = "text/csv",
  WASM        = "application/wasm",
}
```

### `UploadResult`

```typescript
interface UploadResult {
  hash: string;  // Arweave transaction ID
  url: string;   // Full gateway URL
  size: number;  // Bytes uploaded
}
```

### `EncryptedData`

```typescript
interface EncryptedData {
  ciphertext: Uint8Array;
  encryptedSymmetricKey: string;
  accessControlConditions: unknown[];
}
```

---

## Full Example

Register a project, upload a version artifact to Arweave, and push the version on-chain:

```typescript
import { InkdClient, ArweaveClient, ADDRESSES } from "@inkd/sdk";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as fs from "fs";

const account = privateKeyToAccount("0xYOUR_PRIVATE_KEY");
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() });

// 1. Create client
const inkd = new InkdClient({ walletClient, network: "testnet" });

// 2. Approve $INKD spend (only needed once per project)
await inkd.approveToken();

// 3. Register project
const createHash = await inkd.createProject({
  name: "my-agent",
  description: "Autonomous on-chain agent",
  isAgent: true,
  agentEndpoint: "https://api.my-agent.xyz",
});
// Wait for receipt and extract projectId from logs...
const projectId = 1n; // from event log

// 4. Upload artifact to Arweave
const arweave = new ArweaveClient("https://node2.irys.xyz", "0xYOUR_PRIVATE_KEY");
await arweave.connect();

const artifact = fs.readFileSync("./dist/agent.tar.gz");
const upload = await arweave.uploadFile(artifact, "application/gzip");

// 5. Push version on-chain
await inkd.pushVersion(projectId, {
  arweaveHash: upload.hash,
  versionTag: "v0.9.0",
  changelog: "Initial release",
});

console.log("Version live at:", arweave.getUrl(upload.hash));
```

---

*See also: [QUICKSTART.md](./QUICKSTART.md) (CLI path) · [getting-started.md](./getting-started.md) (SDK path) · [SDK_REFERENCE.md](./SDK_REFERENCE.md) (advanced modules) · [CLI_REFERENCE.md](./CLI_REFERENCE.md)*
