# silentBTC Mainnet Release Track Internal Review

Date: 2026-04-23

Scope reviewed:

- `stacks-contracts/contracts/silent-bridge-mainnet.clar`
- `stacks-contracts/tests/silent-bridge-mainnet.test.ts`
- `frontend/src/components/DemoBridge.tsx`
- `frontend/src/lib/stacks-config.ts`
- `docs/SOLVER_POLICY.md`

## Summary

The release track is materially safer than the sandbox track because it:

- removes `USDCx` from Mainnet scope
- limits supported pairs to `STX <-> sBTC`
- requires a user-specified `min-output-amount`
- rejects solver fulfillment below the stored floor
- preserves reclaimability for pending intents

No blocking logic bug was identified in the local internal review after the final verification pass. Residual risk remains in the operator trust model and in deployment-time configuration.

## Residual Risks

### 1. Centralized solver trust

Severity: Medium

The solver is still owner-gated. Users are protected from under-delivery below the stored floor, but not from missed fills, delayed fills, or operator unavailability.

### 2. No on-chain quote expiry

Severity: Medium

The contract stores a minimum output floor but does not store an expiry. Operational policy must ensure stale intents are not fulfilled against outdated market assumptions.

### 3. Deployment/configuration sensitivity

Severity: High

Mainnet safety depends on:

- the correct deployed contract address being wired into the frontend
- the frontend staying scoped to `STX <-> sBTC`
- the solver using the same contract and policy version as the frontend

## Internal Verification Completed

- `clarinet check`: passed
- `npm test` in `stacks-contracts`: passed
- `npm run lint` in `frontend`: passed
- `npm run build` in `frontend`: passed

## External Review Status

External audit is still required. This internal review is preparation material and does not replace an independent third-party security assessment.
