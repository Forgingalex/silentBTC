# Solver Operations

This document defines how the silentBTC solver should quote, fund, fulfill, pause, and recover on the `silent-bridge-mainnet` release track.

## Scope

- supported pairs:
  - `STX -> sBTC`
  - `sBTC -> STX`
- unsupported on Mainnet:
  - any `USDCx` route

## Required Inputs Per Quote

Every quote must be computed from:

- pair
- input amount
- current solver liquidity
- price source snapshot
- fee policy version
- quote timestamp
- quote expiry

## Quote Output

Every quote response must include:

- `pair`
- `inputAmount`
- `expectedOutputAmount`
- `minimumOutputAmount`
- `solverFeeBps`
- `priceSource`
- `quotedAt`
- `expiresAt`

The frontend should submit `minimumOutputAmount` to `silent-bridge-mainnet` and the solver must refuse to fulfill below it.

## Price Source Requirements

Use a deterministic quote source and record:

- source name
- source timestamp
- source market symbols
- any normalization logic between STX units and sBTC satoshis

If the source is unavailable or stale, the solver must refuse to quote.

## Funding Procedure

1. top up STX liquidity through `provide-stx-liquidity`
2. top up sBTC liquidity through `provide-sbtc-liquidity`
3. record operator, amount, txid, and post-balance

## Fulfillment Procedure

1. fetch pending intent
2. verify:
   - pair
   - input amount
   - minimum output amount
   - current liquidity
3. compute output amount
4. verify `outputAmount >= minimumOutputAmount`
5. call `fulfill-swap`
6. record txid, output amount, quote source, and resulting accounting

## Pause Procedure

Pause quoting and fulfillment if any of the following occurs:

- quote source unavailable
- accounting mismatch between contract state and chain balances
- unexplained fulfill or reclaim failure
- operator key compromise suspicion
- audit-critical finding remains unresolved

## Recovery Procedure

Before resuming:

1. reconcile on-chain balances against `get-accounting`
2. review pending intents
3. re-enable quoting only after a second operator reviews the incident

## Key Management

- operator signing keys must be separate from development keys
- operator machine access must be restricted
- mnemonic or hardware signer access must be logged and reviewed
