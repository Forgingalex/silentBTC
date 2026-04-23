# silentBTC Pre-Deployment Security Review

Date: 2026-04-23

## Scope

- `stacks-contracts/contracts/silent-bridge.clar`
- `stacks-contracts/contracts/usdcx-token.clar`
- `frontend/src/components/DemoBridge.tsx`
- `frontend/src/lib/stacks-config.ts`
- Clarinet deployment settings

## Summary

The audit focused on fund custody, reclaimability, fulfillment, post-conditions, asset principals, wallet connectivity, and testnet/mainnet configuration. Critical deployment blockers were fixed in this pass.

## Findings

### Critical: Frontend Testnet Network Constructor Crash

`StacksTestnet` is not exported by the installed `@stacks/network` package. The frontend now uses `STACKS_TESTNET` and `STACKS_MAINNET`.

Status: Fixed.

### Critical: Leather Connect Runtime Crash

The frontend used the legacy `showConnect` flow. The installed Stacks Connect package exposed that path incompatibly in the browser bundle, causing `showConnect is not a function` and preventing Leather wallet pairing.

Fix: Replaced the auth path with the current `connect()` request API, persisted the selected STX address by configured network, and passed `stxAddress` into contract calls.

Status: Fixed.

### Critical: Pending User Escrow Used As Solver Liquidity

The previous fulfillment tests and model allowed one user's pending escrow to act as liquidity for another user's fulfillment. This can break reclaim guarantees.

Fix: Added explicit escrow and liquidity accounting with separate `escrowed-*` and `liquidity-*` variables.

Status: Fixed.

### High: Mock Asset Leakage Into Production Protocol

`mock-usdcx` had unrestricted minting and was reachable from protocol swap paths.

Fix: Replaced it with an owner-gated SIP-010 `usdcx-token` for local/testnet testing and added a Mainnet gate requiring a verified USDCx issuer principal or a separate issuer audit.

Status: Fixed.

### High: Missing Third-Asset Accounting

Adding USDCx without dedicated accounting would risk mixing user escrow and solver liquidity.

Fix: Added `escrowed-usdcx`, `liquidity-usdcx`, USDCx reclaim logic, USDCx liquidity functions, and fulfillment branches for USDCx outputs.

Status: Fixed.

### High: Frontend Dependency Advisories

`npm audit --omit=dev` reported Next.js denial-of-service advisories and a vulnerable Stacks Connect dependency chain through Reown/BIP322 packages.

Fix: Upgraded Next.js to `16.2.4`, aligned ESLint tooling, pinned Stacks Connect to `8.1.9`, and verified `npm audit --omit=dev` now reports zero frontend vulnerabilities.

Status: Fixed.

### High: Environment-Specific Address Selection

The frontend previously loaded only Mainnet wallet addresses and Mainnet Hiro API data.

Fix: Added environment-driven network configuration and address selection.

Status: Fixed.

### Medium: Duplicate Pending Intent Overwrite

A user could overwrite a pending intent by locking again.

Fix: Added `ERR_INTENT_EXISTS` guard.

Status: Fixed.

## Residual Risks

- Owner key compromise can drain owner-provided liquidity. Use a hardware wallet or multisig for Mainnet ownership.
- The included USDCx issuer is owner-mintable for testnet/local use. Do not treat it as production USDCx without a separate issuer audit and explicit supply policy.
- Solver price execution is off-chain. Users should receive a quote and explicit slippage policy before Mainnet launch.
- Existing testnet deployments are immutable. Redeploy the hardened source under a new contract name or deployer before final E2E testing.

## Verification

- `clarinet check`
- `npm test` in `stacks-contracts`
- `npx tsc --noEmit` in `frontend`
- `npm run build` in `frontend`
- `npm audit --omit=dev` in `frontend`
- `npm audit --omit=dev` in `stacks-contracts`
