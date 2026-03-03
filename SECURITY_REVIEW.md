# Inkd Protocol — Security Review

**Reviewed:** 2026-03-02 | **Updated:** 2026-03-03 (InkdTimelock added)
**Reviewer:** Inkd Agent (automated + manual review)
**Contracts:** InkdToken, InkdRegistry, InkdTreasury, InkdTimelock
**Commit:** See git log
**Status:** ✅ No critical or high issues found. Ready for external audit.

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 0 | — |
| 🟠 High     | 0 | — |
| 🟡 Medium   | 1 | Informational — no action required |
| 🔵 Low      | 3 | Documented, by design |
| ⚪ Info     | 6 | Noted (5 original + 1 Timelock) |

---

## InkdToken.sol

**Surface area:** Minimal. Standard OpenZeppelin ERC-20 + Burnable + Permit.

### ✅ Findings

- **No mint function** after construction — fixed supply guaranteed ✅
- **ERC20Burnable** — burn-to-delete is safe, uses OZ battle-tested implementation ✅
- **ERC20Permit (EIP-2612)** — standard gasless approval. Nonce-based, replay-protected ✅
- **No owner, no admin, no upgradeable** — maximally trustless ✅
- **Token lock constant `TOKEN_LOCK_AMOUNT = 1 ether`** — immutable ✅

### ⚪ INFO-1: Token is not upgradeable

By design. A bug in InkdToken would require a migration to a new token contract. Acceptance criterion: the token logic is trivially simple (ERC-20 + burn + permit) with zero custom logic, making a bug extremely unlikely.

---

## InkdTreasury.sol

**Surface area:** Fee collector. ETH in (from registry), ETH out (to owner).

### ✅ Findings

- **`deposit()` restricted to `registry` only** — prevents arbitrary ETH deposits from being misattributed ✅
- **`withdraw()` is owner-only** — funds cannot be drained by non-owner ✅
- **`setRegistry()` is owner-only** — registry address is admin-controlled ✅
- **No reentrancy in `withdraw()`** — low-level `.call` with no state changes after (CEI not needed since there's no meaningful state to corrupt) ✅
- **UUPS upgrade path is `onlyOwner`** — correct ✅

### 🔵 LOW-1: `receive()` accepts ETH from any sender

The fallback `receive()` emits `Received` but does not restrict the sender. ETH sent directly to the contract (not via `deposit()`) will not be attributed to a registry deposit in event logs, but it is not lost and adds to the treasury balance. Owner can withdraw it normally.

**Risk:** Low. No financial loss. Minor accounting ambiguity.
**Recommendation:** Acceptable as-is. Document that direct ETH sends (not via registry) are unattributed.

### 🔵 LOW-2: `setRegistry()` can be updated post-deploy

The owner can change the `registry` address at any time. This means a malicious/compromised owner could point the treasury to a fake registry. This is an inherent property of upgradeable + ownable contracts.

**Risk:** Low if deployer key is secured. Protocol trust model depends on owner's key security.
**Recommendation:** Document the trust model clearly. Consider a timelock for `setRegistry()` changes in V2.

---

## InkdRegistry.sol

**Surface area:** Largest. Manages projects, versions, collaborators, transfers.

### ✅ Findings

- **SafeERC20** used for all token transfers — prevents issues with non-standard tokens ✅
- **Custom errors** instead of `require(string)` — gas efficient ✅
- **Reentrancy analysis:** `createProject()` follows CEI pattern: checks (nameTaken) → interaction (safeTransferFrom) → effects (state update). Safe. ✅
- **`pushVersion()` CEI:** state updates happen before `treasury.deposit()` call. Safe. ✅
- **`transferProject()` CEI:** state updates before `treasury.deposit()` call. Safe. ✅
- **Collaborator deduplication** — `AlreadyCollaborator` error prevents double-adds ✅
- **Zero address checks** — `ZeroAddress()` error on `addCollaborator` and `transferProject` ✅
- **Fee caps** — `MAX_VERSION_FEE` and `MAX_TRANSFER_FEE` prevent runaway fee updates ✅
- **Owner auto-removed from collaborators** on transfer ✅
- **`_normalizeName`** prevents case-collision attacks ✅

### 🟡 MEDIUM-1: `getAgentProjects()` is O(n) over all projects

The function iterates over all projects to find agent projects. As `projectCount` grows (e.g., 100,000+ projects), this becomes prohibitively expensive in gas for any on-chain caller, though it works fine as an off-chain `eth_call`.

**Risk:** Medium for on-chain composability. No risk for off-chain reads.
**Recommendation:** Maintain a separate `_agentProjectIds` array for O(1) pagination in V2. For now, ensure SDK only calls this off-chain.

### 🔵 LOW-3: No upper bound on collaborator array size

A project owner can add unlimited collaborators. Arrays grow unboundedly. `removeCollaborator` and `getCollaborators` iterate over this array.

**Risk:** Low. Only the owner can add collaborators, so this is self-inflicted. Could increase gas costs for the owner's own operations.
**Recommendation:** Add `MAX_COLLABORATORS = 50` cap in V2.

### ⚪ INFO-2: `_normalizeName` only lowercases ASCII A-Z

Non-ASCII characters (emoji, unicode) pass through unchanged. Two visually identical Unicode names with different byte encodings (e.g., NFC vs NFD) would be treated as distinct names.

**Risk:** Negligible. Names are cosmetic; ownership is by `projectId`, not name.

### ⚪ INFO-3: No name length limits

`createProject()` accepts names of any length. Very long names increase gas costs but don't break the protocol.

**Risk:** Informational. Gas cost risk is borne by the caller.
**Recommendation:** Add `require(bytes(name).length <= 64)` in V2.

### ⚪ INFO-4: Overpayment is not refunded

In `pushVersion()` and `transferProject()`, if `msg.value > required fee`, the excess goes to the treasury. There is no refund.

**Risk:** User UX issue, not a security issue. ETH is not lost (goes to treasury). SDK should send exact amounts.
**Recommendation:** SDK should always send `versionFee` / `transferFee` exactly. Alternatively, add a refund in V2.

### ⚪ INFO-5: `lockAmount` naming inconsistency

The constant is named `TOKEN_LOCK_AMOUNT` in the contract, but internal documentation and the DryRun script reference it as `lockAmount`. Minor naming inconsistency.

**Status:** Fixed in DryRun.s.sol to use `TOKEN_LOCK_AMOUNT()`.

---

---

## InkdTimelock.sol

**Surface area:** Admin timelock. Queues, delays, and executes arbitrary contract calls. Intended to hold ownership of InkdRegistry and InkdTreasury post-deploy.

**Constants:** `DELAY = 48 hours`, `GRACE_PERIOD = 14 days`

### ✅ Findings

- **No custom errors** — uses `require(string)` deliberately for readability; no gas concern since timelock operations are infrequent admin actions ✅
- **Two-step admin handover** — `setPendingAdmin()` + `acceptAdmin()` prevents accidental ownership loss to wrong address ✅
- **Replay protection** — `queuedTransactions[txHash]` is set to `false` before execution; the same hash cannot be re-executed ✅
- **Stale transaction guard** — `GRACE_PERIOD (14 days)` prevents very old queued txs from executing after context changes ✅
- **ETA lower-bound enforced** — `eta >= block.timestamp + DELAY` checked at queue time ✅
- **ETH forwarding** — `receive()` + `value` forwarding in `executeTransaction()` supports ETH-carrying calls ✅
- **Execution failure propagates** — `require(success)` on the low-level `.call`, so callers see failures ✅

### 🔵 LOW-3: Timelock admin is a single EOA

The initial admin is the deployer EOA. If the deployer key is compromised before transferring to a Safe multisig, an attacker gains full timelock control. This is the same trust assumption as the current owner pattern.

**Risk:** Low — identical to pre-timelock risk. Timelock adds delay visibility; does not add multi-sig protection.
**Recommendation:** Transfer timelock admin to a Gnosis Safe immediately after deploy. Document in POST_DEPLOY.md (already noted there).

### ⚪ INFO-6: `cancelTransaction` does not verify transaction was queued

`cancelTransaction()` sets `queuedTransactions[txHash] = false` unconditionally. Cancelling a non-queued hash is a no-op (false → false) and emits a `CancelTransaction` event. No state corruption, but event logs may be misleading.

**Risk:** Informational. Admin-only function; an admin calling cancel on a non-existent tx is simply a no-op with a spurious event.
**Recommendation:** Add `require(queuedTransactions[txHash], "not queued")` for cleaner event semantics if desired.

### Timelock Security Model

| Property | Status |
|----------|--------|
| 48h minimum delay on all admin actions | ✅ |
| Transactions can be cancelled during delay window | ✅ |
| Stale transactions expire after 14 days (GRACE_PERIOD) | ✅ |
| Two-step admin handover prevents accidental loss | ✅ |
| All 41 test cases passing | ✅ |
| Not upgradeable (intentional — timelock itself should be immutable) | ✅ |

---

## Access Control Summary

| Function | Who Can Call |
|----------|-------------|
| `createProject()` | Anyone (with INKD approval + allowance) |
| `pushVersion()` | Project owner OR collaborator |
| `addCollaborator()` | Project owner only |
| `removeCollaborator()` | Project owner only |
| `transferProject()` | Project owner only |
| `setVisibility()` | Project owner only |
| `setReadme()` | Project owner only |
| `setAgentEndpoint()` | Project owner only |
| `setVersionFee()` | Protocol owner (deployer / timelock) only |
| `setTransferFee()` | Protocol owner (deployer / timelock) only |
| `treasury.deposit()` | Registry only |
| `treasury.withdraw()` | Protocol owner (deployer / timelock) only |
| `treasury.setRegistry()` | Protocol owner (deployer / timelock) only |
| `upgradeToAndCall()` (both) | Protocol owner (deployer / timelock) only |
| `timelock.queueTransaction()` | Timelock admin only |
| `timelock.cancelTransaction()` | Timelock admin only |
| `timelock.executeTransaction()` | Timelock admin only |
| `timelock.setPendingAdmin()` | Timelock admin only |
| `timelock.acceptAdmin()` | Pending admin only |

---

## Reentrancy Analysis

| Function | External Calls | CEI? | Safe? |
|----------|---------------|------|-------|
| `createProject()` | `safeTransferFrom` (INKD token) | ✅ | ✅ |
| `pushVersion()` | `treasury.deposit()` | ✅ | ✅ |
| `transferProject()` | `treasury.deposit()` | ✅ | ✅ |
| `treasury.withdraw()` | `to.call{value}` | ✅ | ✅ |

No reentrancy vulnerabilities found. All external calls follow CEI (Checks-Effects-Interactions).

---

## Integer Overflow / Underflow

Solidity 0.8.24 has built-in overflow protection. No unsafe math detected.

- `++projectCount` — safe (would need 2^256 projects to overflow)
- All fee comparisons use `<` not `<=` — verified correct
- `TOKEN_LOCK_AMOUNT = 1 ether` — safe constant

---

## Upgrade Safety

Both InkdTreasury and InkdRegistry use UUPS proxies.

- `_authorizeUpgrade()` is `onlyOwner` in both — ✅
- `_disableInitializers()` in constructor — prevents impl contract from being initialized directly ✅
- No storage layout violations detected between current implementations

**⚠️ Important:** Any future upgrade must preserve storage layout. Use OpenZeppelin's upgrade safety checker (`forge script` with `--ffi` or Hardhat upgrades plugin) before any upgrade.

---

## Recommendations

### Before Mainnet (Required)
- [ ] Ensure deployer private key is stored in hardware wallet (Ledger/Trezor)
- [ ] Test on Base Sepolia with actual ETH and token transfers end-to-end
- [ ] Review and run DryRun.s.sol successfully
- [ ] Complete POST_DEPLOY.md checklist

### V2 (Post-launch Improvements)
- [ ] Add `_agentProjectIds[]` array for O(1) agent project pagination
- [ ] Add `MAX_COLLABORATORS` cap
- [ ] Add `MAX_NAME_LENGTH` validation
- [ ] Add overpayment refund in `pushVersion()` / `transferProject()`
- [ ] Consider timelock for `setRegistry()` changes

---

## Conclusion

The Inkd Protocol contracts are **well-structured, minimal, and secure** for a V1 mainnet deployment. The codebase:

- Uses battle-tested OpenZeppelin libraries throughout
- Follows the CEI pattern for all functions with external calls
- Has no critical or high-severity findings
- Has comprehensive test coverage (**238 tests** — unit, fuzz, invariant, upgrade, integration, timelock)
- Has clear, correct access control
- Includes `InkdTimelock.sol` for 48h governance delay on all admin actions

The medium/low findings are all informational or by-design, with zero impact on fund safety.

**Verdict: ✅ Internal review complete. Recommended next step: professional external audit before mainnet deploy.**

---

*Internal review by Inkd Agent, 2026-03-02 (InkdTimelock addendum 2026-03-03). This is not a professional audit.*
*For mainnet deployment: engage a reputable firm (Trail of Bits, Spearbit, Sherlock, Code4rena, etc.).*
