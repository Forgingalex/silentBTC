# Mainnet Quote Source

## Summary

The release track uses an internal quote service served by the frontend deployment.

Path:

`/api/quote`

This endpoint computes the expected output and the minimum output for:

1. `STX -> sBTC`
2. `sBTC -> STX`

## Source definition

1. source name: `silentBTC internal quote engine`
2. source endpoint: `/api/quote`
3. freshness threshold: `30 seconds`
4. fee basis points: `30`
5. slippage buffer: `50`
6. fallback mode: quoting pauses if the service cannot provide a fresh quote

## Price inputs

The quote service reads:

1. `QUOTE_STX_USD`
2. `QUOTE_BTC_USD`

These values are used to derive the cross rate between `STX` and `sBTC`.

## Formula

The service:

1. normalizes `STX` from micro STX
2. normalizes `sBTC` from satoshis
3. computes the expected output amount from the configured reference prices
4. applies the fee
5. applies the slippage buffer
6. returns the resulting minimum output amount

## Runtime values

The endpoint also returns:

1. `quotedAt`
2. `expiresAt`
3. `sourceName`
4. `sourceEndpoint`
5. `solverFeeBps`
6. `slippageBufferBps`

## Operational rule

The solver must not fulfill below the on chain `min-output-amount`.

If the quote is stale or unavailable:

1. do not quote
2. do not fulfill
3. pause the operator flow until the issue is understood

## Logging

Quote requests and fulfillment decisions should be retained in the application logs and operator records.

## Source files

1. `/Users/apple/Downloads/silentBTC/frontend/src/lib/quote-config.ts`
2. `/Users/apple/Downloads/silentBTC/frontend/src/app/api/quote/route.ts`
