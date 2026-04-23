# silentBTC

silentBTC is a Stacks intent bridge for `STX` and `sBTC`.

The product lets a user lock one asset, set a minimum acceptable return, choose a routing preference, and wait for a solver to fulfill the swap with pre funded liquidity. If the intent is still pending, the user can reclaim escrow and exit cleanly.

This repository contains two tracks:

1. A Mainnet release track for `STX <-> sBTC`
2. A broader sandbox track for local work and testnet experiments

## What ships to Mainnet

The Mainnet release is intentionally narrow.

1. `STX -> sBTC`
2. `sBTC -> STX`

`USDCx` stays out of Mainnet scope.

## Safety model

silentBTC is built around four protections.

1. Exact post conditions protect the asset leaving the wallet.
2. Every Mainnet intent stores a minimum acceptable output.
3. Pending escrow can be reclaimed by the user.
4. Solver liquidity is tracked separately from user escrow.

## Repository structure

```text
silentBTC/
├── audits/            Security review notes and freeze records
├── docs/              Product, architecture, operations, testing, and release docs
├── frontend/          Next.js app and quote service
├── stacks-contracts/  Clarinet workspace and Clarity contracts
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── SECURITY.md
```

## Key files

1. `/Users/apple/Downloads/silentBTC/stacks-contracts/contracts/silent-bridge-mainnet.clar`
   Mainnet release contract for `STX <-> sBTC`
2. `/Users/apple/Downloads/silentBTC/stacks-contracts/contracts/silent-bridge.clar`
   Sandbox contract with broader route coverage
3. `/Users/apple/Downloads/silentBTC/frontend/src/components/DemoBridge.tsx`
   Main application surface, wallet actions, operator tools, and explorer
4. `/Users/apple/Downloads/silentBTC/frontend/src/app/api/quote/route.ts`
   Internal quote endpoint used by the frontend and solver flow

## Quick start

### Contracts

```bash
cd /Users/apple/Downloads/silentBTC/stacks-contracts
npm install
clarinet check
npm test
```

### Frontend

```bash
cd /Users/apple/Downloads/silentBTC/frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Documentation

1. [User Guide](/Users/apple/Downloads/silentBTC/docs/USER_GUIDE.md)
2. [Architecture](/Users/apple/Downloads/silentBTC/docs/ARCHITECTURE.md)
3. [Deployment](/Users/apple/Downloads/silentBTC/docs/DEPLOYMENT.md)
4. [Testing](/Users/apple/Downloads/silentBTC/docs/TESTING.md)
5. [Quote Source](/Users/apple/Downloads/silentBTC/docs/QUOTE_SOURCE.md)
6. [Solver Policy](/Users/apple/Downloads/silentBTC/docs/SOLVER_POLICY.md)
7. [Solver Operations](/Users/apple/Downloads/silentBTC/docs/SOLVER_OPERATIONS.md)
8. [Mainnet Release Notes](/Users/apple/Downloads/silentBTC/docs/MAINNET-RELEASE-NOTES.md)
9. [Mainnet Release Checklist](/Users/apple/Downloads/silentBTC/docs/MAINNET-RELEASE-CHECKLIST.md)

## Verification

Run this before every release candidate:

```bash
cd /Users/apple/Downloads/silentBTC/stacks-contracts
clarinet check
npm test

cd /Users/apple/Downloads/silentBTC/frontend
npm run lint
npm run build
```

## Deployment note

Do not deploy to Mainnet until all of the following are true:

1. The release checklist is complete
2. The release contract has passed the full dress rehearsal
3. The external audit result is recorded
4. The production quote source is finalized

Use `/Users/apple/Downloads/silentBTC/docs/DEPLOYMENT.md` as the deployment runbook.
