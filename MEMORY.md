# MEMORY.md — Long-Term Memory

_Curated distillation of decisions, lessons, and context. Updated nightly._

---

## The Human

- **Name:** Hazar (Telegram: @hazarkemal)
- **Timezone:** Asia/Dubai (GMT+4)
- **Language:** Prefers German in conversation; project docs in English
- **Style:** Direct, no filler. Hates being told something is "done" when it isn't.

---

## Active Projects

### INKD Protocol (`inkdprotocol.com`)

A token/registry protocol on Base (EVM). Key artifacts:

- **Website:** `inkdprotocol.com` — all sections live, `/legal` (ToS + Privacy Policy) deployed 2026-03-03
- **Token:** `$TEST` on Base Sepolia (1B supply), deployer holds 100%
- **Contracts:** Registry Proxy + Impl, Treasury Proxy + Impl — all verified on Basescan ✅
- **Timelock:** `InkdTimelock` deployed + verified at `0xaE6069d77cd93a1d6cA00eEf946befb966699491` (48h delay)
- **Uniswap Pool:** `0x096D02F26091c24387D914Cb7CffAC7eD44aa7F0` (live, has liquidity)
- **npm:** `@inkd/sdk@0.9.0` + `@inkd/cli@0.1.0` published
- **GitHub:** `inkdprotocol/inkd-protocol` — main branch, public, clean

**Test suite (as of 2026-03-03):**
- Contracts: 170/170 ✅
- SDK: 323/323 ✅ (100% coverage all metrics)
- CLI: 318/318 ✅
- Total: 811 tests

**OPEN / BLOCKING as of 2026-03-03:**
- ❌ **Safe Multisig not created** — Hazar needs to go to app.safe.global → create on Base → send me the address → I transfer Registry + Treasury ownership
- ❌ **LP Lock** — liquidity on Uniswap not locked yet; Hazar needs to use Unicrypt (app.uncx.network) with deployer wallet
- ❌ **Timelock not yet set as owner** — waiting on Multisig first
- ⚠️ **Security Audit** — recommended before mainnet $INKD launch (Certik / Spearbit, ~$15-50k, 2-8 weeks)
- ⚠️ **$INKD Mainnet deploy** — planned, needs BASE_MAINNET_RPC + Basescan verify
- ⚠️ **Token distribution plan** — 100% in deployer wallet; needs vesting schedules before public launch

---

## Lessons Learned

- **Don't say "done" prematurely.** On 2026-03-03, I told Hazar we were "fertig" when multisig, LP lock, and security audit were still open. That was a failure. Always give a complete status, including what's still blocking.
- **Hazar expects full honesty on blockers**, not optimistic summaries.

---

## Infrastructure Notes

- Basescan API Key: saved/configured
- WalletConnect Project ID: real one set (not placeholder)
- Contract deployment scripts: in repo under `scripts/`

---

_Last updated: 2026-03-04 00:00 (midnight consolidation)_
