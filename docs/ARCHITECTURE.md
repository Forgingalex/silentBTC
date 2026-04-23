# Architecture

## Overview

silentBTC has one product goal on Mainnet: move between `STX` and `sBTC` through a controlled intent flow with clear user protections.

The system has four parts:

1. The release contract
2. The frontend
3. The quote service
4. The solver operation

## Repository layout

```text
silentBTC/
├── audits/
├── docs/
├── frontend/
│   ├── src/app/
│   ├── src/components/
│   └── src/lib/
└── stacks-contracts/
    ├── contracts/
    ├── settings/
    └── tests/
```

## Contract tracks

### Mainnet release track

`/Users/apple/Downloads/silentBTC/stacks-contracts/contracts/silent-bridge-mainnet.clar`

This contract supports:

1. `lock-stx-for-sbtc`
2. `lock-sbtc-for-stx`
3. `reclaim-escrow`
4. `provide-stx-liquidity`
5. `provide-sbtc-liquidity`
6. `withdraw-stx-liquidity`
7. `withdraw-sbtc-liquidity`
8. `fulfill-swap`

This is the only contract intended for Mainnet deployment.

### Sandbox track

`/Users/apple/Downloads/silentBTC/stacks-contracts/contracts/silent-bridge.clar`

This contract exists for broader route experiments and local or testnet work. It is not part of the Mainnet release scope.

## Intent model

Every Mainnet intent stores:

1. `input-amount`
2. `min-output-amount`
3. `from-asset`
4. `to-asset`
5. `preference`
6. `status`
7. `created-at`

This gives the contract enough information to enforce the user floor at settlement time.

## Accounting model

The release contract tracks user escrow separately from solver liquidity.

For `STX`:

1. `escrowed-stx`
2. `liquidity-stx`

For `sBTC`:

1. `escrowed-sbtc`
2. `liquidity-sbtc`

This separation matters. Pending user escrow is not treated as free solver inventory.

## Frontend

The frontend lives in `/Users/apple/Downloads/silentBTC/frontend`.

The main application surface is:

`/Users/apple/Downloads/silentBTC/frontend/src/components/DemoBridge.tsx`

It is responsible for:

1. wallet connection
2. route selection
3. minimum output capture
4. post condition construction
5. operator actions for testnet and rehearsal
6. explorer state sync

## Quote service

The quote endpoint is:

`/Users/apple/Downloads/silentBTC/frontend/src/app/api/quote/route.ts`

The quote configuration is:

`/Users/apple/Downloads/silentBTC/frontend/src/lib/quote-config.ts`

The quote service returns:

1. expected output
2. minimum output
3. fee basis points
4. slippage buffer
5. quote timestamp
6. expiry

The frontend uses the returned minimum output when it builds a Mainnet release intent.

## Network configuration

Network and principal selection live in:

`/Users/apple/Downloads/silentBTC/frontend/src/lib/stacks-config.ts`

The app chooses:

1. the Stacks network
2. the release contract principal
3. the sBTC principal
4. the Hiro API base URL
5. the explorer chain

## User safety

The release flow depends on these checks:

1. exact post conditions on the asset leaving the wallet
2. an on chain minimum output floor
3. reclaim while the intent is pending
4. owner only fulfillment
5. separate liquidity accounting

## Operational boundary

silentBTC is not a trustless AMM.

The solver is operational and owner gated. The contract protects the user from a bad debit and from a fulfillment below the stored minimum output. Liquidity management, uptime, and quote quality still depend on the operator.
