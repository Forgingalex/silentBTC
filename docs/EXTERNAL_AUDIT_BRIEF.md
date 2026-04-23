# External Audit Brief

## Goal

Audit the `silent-bridge-mainnet` release track for live Mainnet deployment.

## In-Scope Source

- `stacks-contracts/contracts/silent-bridge-mainnet.clar`
- `stacks-contracts/tests/silent-bridge-mainnet.test.ts`
- `frontend/src/components/DemoBridge.tsx`
- `frontend/src/lib/stacks-config.ts`
- `docs/SOLVER_POLICY.md`
- `docs/SOLVER_OPERATIONS.md`
- `docs/QUOTE_SOURCE.md`
- `audits/2026-04-23-mainnet-release-track-internal-review.md`

## Out of Scope for the First Mainnet Audit

- `contracts/usdcx-token.clar`
- `stacks-contracts/contracts/silent-bridge.clar`
- `USDCx` routes
- testnet-only operator tooling beyond its influence on release-track logic

## Primary Questions

1. Can user funds be drained without satisfying the intended transfer path?
2. Can solver fulfillment violate the stored `min-output-amount`?
3. Can escrow and liquidity accounting drift in a way that breaks withdrawals or reclaim?
4. Can a pending user lose reclaimability?
5. Are post-condition assumptions reflected correctly in the frontend transaction builder?
6. Are there privileged flows whose risks are not clearly disclosed?

## Expected Deliverables

- severity-ranked findings
- recommended fixes
- explicit statement on whether the release track is suitable for guarded mainnet rollout
- assumptions and residual risks

## Auditor Notes

- Mainnet release scope is `STX <-> sBTC` only.
- Solver fulfillment is owner-gated by design.
- The frontend requires an explicit mainnet acknowledgement before allowing live intent submission.
- The release handoff should include a checksum manifest for the frozen contract source.
