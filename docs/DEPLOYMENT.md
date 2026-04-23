# Deployment

## Scope

This runbook is for the Mainnet release contract:

`/Users/apple/Downloads/silentBTC/stacks-contracts/contracts/silent-bridge-mainnet.clar`

Mainnet scope includes only:

1. `STX -> sBTC`
2. `sBTC -> STX`

## Before deployment

Do not deploy until these are complete:

1. `clarinet check` passes
2. contract tests pass
3. frontend lint passes
4. frontend build passes
5. the release checklist is complete
6. the dress rehearsal is complete
7. the quote source is finalized
8. the audit result is recorded

## Local verification

```bash
cd /Users/apple/Downloads/silentBTC/stacks-contracts
clarinet check
npm test

cd /Users/apple/Downloads/silentBTC/frontend
npm run lint
npm run build
```

## Environment files

Use these files:

1. `/Users/apple/Downloads/silentBTC/frontend/.env.example`
2. `/Users/apple/Downloads/silentBTC/frontend/.env.mainnet.example`
3. `/Users/apple/Downloads/silentBTC/stacks-contracts/settings/Mainnet.example.toml`

Create the real Mainnet settings file:

```bash
cd /Users/apple/Downloads/silentBTC/stacks-contracts
cp settings/Mainnet.example.toml settings/Mainnet.toml
```

Then update `settings/Mainnet.toml` with the funded Mainnet deployer mnemonic and account details.

## Mainnet contract deploy

Generate the Mainnet plan:

```bash
cd /Users/apple/Downloads/silentBTC/stacks-contracts
clarinet deployments generate --mainnet --manual-cost
```

Apply the plan:

```bash
clarinet deployments apply --mainnet -c --no-dashboard
```

Record the deployed contract principal. It will look like:

`SP...silent-bridge-mainnet`

## Frontend Mainnet env

After deployment, write the frontend Mainnet env file:

```bash
cd /Users/apple/Downloads/silentBTC/frontend
node scripts/set-mainnet-release-env.mjs SP...silent-bridge-mainnet .env.mainnet.local
```

Then verify:

```bash
npm run build
```

## Vercel

Copy the generated values from `.env.mainnet.local` into the production environment settings for the frontend deployment.

The quote service variables must also be present in production:

1. `QUOTE_SOURCE_NAME`
2. `QUOTE_SOURCE_ENDPOINT`
3. `QUOTE_STX_USD`
4. `QUOTE_BTC_USD`
5. `QUOTE_FEE_BPS`
6. `QUOTE_SLIPPAGE_BPS`
7. `QUOTE_FRESHNESS_SECONDS`
8. `QUOTE_TTL_SECONDS`
9. `QUOTE_FALLBACK_SOURCE`
10. `QUOTE_LOGGING_DESTINATION`

## Post deployment checks

After Mainnet deployment:

1. confirm the contract page loads in Hiro
2. confirm the frontend points at the deployed contract
3. confirm the app only shows `STX <-> sBTC`
4. confirm minimum output is required before submit
5. confirm the quote endpoint responds
6. confirm the operator wallet can fund liquidity

## Not in Mainnet scope

These are not part of the Mainnet release:

1. `USDCx`
2. the sandbox contract
3. the local test token issuer
