# Mainnet Dress Rehearsal

This is a release-track rehearsal for `silent-bridge-mainnet` using testnet-equivalent operational steps. The goal is to prove the exact operator workflow before Mainnet deployment.

## Objectives

1. Verify `STX -> sBTC` and `sBTC -> STX` intent creation.
2. Verify solver funding, fulfillment, and reclaim.
3. Verify the frontend blocks unsupported Mainnet routes.
4. Verify the minimum received guard is enforced end to end.
5. Verify the Silent Explorer reflects `Privacy Shielded`, `Fulfilled`, and `Reclaimed`.

## Required Inputs

- release-track contract source: `stacks-contracts/contracts/silent-bridge-mainnet.clar`
- funded operator wallet
- funded user wallet
- frontend built from the release-track branch
- `.env.mainnet.local` or equivalent generated from `frontend/.env.mainnet.example`

## Rehearsal Steps

### 1. Contract Verification

- run `clarinet check`
- run `npm test` in `stacks-contracts`
- record the git commit and contract file checksum

### 2. Frontend Verification

- run `npm run lint` in `frontend`
- run `npm run build` in `frontend`
- confirm the Mainnet UI only exposes:
  - `STX -> sBTC`
  - `sBTC -> STX`

### 3. User Intent Flow

- connect the user wallet
- submit `STX -> sBTC`
- confirm:
  - `minimum received` is required
  - strict post-conditions appear in the wallet confirmation
  - the intent appears as `Privacy Shielded`

### 4. Solver Funding and Fulfillment

- connect the operator wallet
- fund sBTC liquidity
- fulfill the pending `STX -> sBTC` intent
- confirm:
  - `output-amount >= min-output-amount`
  - the intent moves to `Fulfilled`
  - explorer links resolve correctly

### 5. Reclaim Path

- create a new intent
- do not fulfill it
- reclaim escrow from the user wallet
- confirm:
  - funds return to the user
  - the intent moves to `Reclaimed`

### 6. Reverse Route

- fund STX liquidity
- submit `sBTC -> STX`
- fulfill it
- confirm the same state transitions and min-output protection

## Exit Criteria

- all four critical transactions succeed:
  - lock
  - fulfill
  - reclaim
  - reverse-route fulfill
- the explorer shows correct final states
- no unsupported Mainnet route is callable from the release-track UI
- operator runbook steps are unambiguous to a second team member

## Recordkeeping

Capture and store:

- transaction IDs for lock, fulfill, and reclaim
- screenshots of wallet post-conditions
- final contract/accounting balances
- the exact env file used by the frontend
