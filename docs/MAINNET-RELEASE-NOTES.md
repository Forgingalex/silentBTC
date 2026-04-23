# Mainnet Release Notes

## Release

1. release contract: `silent-bridge-mainnet`
2. release scope: `STX <-> sBTC`
3. frontend deployment URL: production deployment URL to be set at activation
4. deployed contract principal: set after Mainnet deployment
5. deployer principal: set after Mainnet deployment
6. release date: set after Mainnet deployment

## What is included

This release includes:

1. `STX -> sBTC`
2. `sBTC -> STX`
3. strict wallet post conditions
4. a required minimum output field
5. reclaim for pending escrow
6. solver funding and fulfillment tools
7. explorer state sync for pending, fulfilled, and reclaimed intents

## What is not included

This release does not include:

1. `USDCx`
2. the sandbox contract
3. local or test token flows

## User protection

The release uses:

1. exact post conditions for the outgoing asset
2. a minimum output floor stored on chain
3. reclaim for pending intents
4. separated escrow and solver liquidity accounting

## Residual trust assumptions

Users are still relying on an operator in several places.

1. the solver is owner gated
2. liquidity must be funded and managed by the operator
3. quote quality depends on the configured quote source
4. users must review wallet confirmations before signing

## Audit status

1. internal review completed
2. external audit completed, with final report retained in project release records
3. accepted residual findings: none recorded in this repository

## Operations

1. quote source: `silentBTC internal quote engine` at `/api/quote`
2. solver fee policy: `30 bps`
3. slippage buffer: `50 bps`
4. pause contact: project operations contact to be set at activation
