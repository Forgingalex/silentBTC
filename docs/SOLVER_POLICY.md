# Solver Policy

## Mainnet Release Scope

The mainnet solver policy applies only to the `silent-bridge-mainnet` release track:

- `STX -> sBTC`
- `sBTC -> STX`

`USDCx` is out of mainnet scope.

## User Protection Rules

1. Every mainnet intent stores a `min-output-amount`.
2. A solver fulfillment must satisfy `output-amount >= min-output-amount`.
3. If no acceptable fulfillment is available, the intent must remain pending until the user reclaims escrow.
4. The solver must never clear an intent without transferring the output asset first.
5. Pending user escrow is not solver inventory. Solver inventory must be pre-funded through the dedicated liquidity functions.

## Operational Policy

1. Quote generation must be deterministic and reproducible from the same market inputs.
2. Quote response should include:
   - pair
   - input amount
   - minimum output amount
   - solver fee policy
   - quote timestamp
3. Solvers should reject intents they cannot price confidently rather than fulfilling below the user floor.
4. Mainnet operator keys should be separated from everyday development keys.
5. Liquidity top-ups and withdrawals should be logged and reviewed before and after execution.

## Release Gate

Do not enable a mainnet frontend unless:

- the deployed contract address is final
- the solver service is connected to the final contract
- minimum output handling is verified end to end
- reclaim behavior is tested against live pending intents
- an external audit has reviewed the release-track source and policy
