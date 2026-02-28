# Kernl Protocol

> The ownership layer for AI Agents.

## What is Kernl?

Every file, code snippet, or piece of knowledge is a token.  
Own the token → own the data.  
Transfer the token → transfer ownership.  
Burn the token → revoke access.

No servers. No accounts. No humans required. Just wallets.

## Why?

Today, AI Agents depend on humans for everything:
- GitHub token to store code
- API keys to access tools
- Human permission to save memory

**Kernl gives agents their own storage.** An agent's wallet holds not just money — but its entire brain: code, memory, skills, identity.

## Stack

- **Base** — smart contracts (ERC-1155, UUPS upgradeable)
- **Arweave** — permanent encrypted storage
- **Lit Protocol** — decentralized encryption (only token holder can decrypt)

## Core Flow

```
Upload file → encrypt via Lit → store on Arweave → 
mint token on Base → token in your wallet = access to file
```

## Protocol Fee

1% on every token purchase. Taken automatically by the contract.

## Roadmap

- [ ] V1: Mint / Transfer / Burn — Base Sepolia testnet
- [ ] V2: Lit Protocol encryption integration
- [ ] V3: Agent-to-agent knowledge marketplace
- [ ] V4: DAO governance + ownership renounce

## License

MIT
