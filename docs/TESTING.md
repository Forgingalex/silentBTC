# Testing

## Automated checks

### Contracts

```bash
cd /Users/apple/Downloads/silentBTC/stacks-contracts
clarinet check
npm test
```

### Frontend

```bash
cd /Users/apple/Downloads/silentBTC/frontend
npm run lint
npm run build
```

## What the contract tests cover

The release track test suite covers:

1. `STX -> sBTC` intent storage
2. `sBTC -> STX` intent storage
3. rejection of zero minimum output
4. fulfillment above the user floor
5. rejection below the user floor
6. reclaim of pending escrow
7. separation of escrow and liquidity accounting

## Manual rehearsal that was completed on testnet

The release track was exercised on testnet with the deployed release contract.

Completed scenarios:

1. `STX -> sBTC` lock
2. `STX -> sBTC` fulfill
3. `STX -> sBTC` reclaim
4. `sBTC -> STX` lock
5. `sBTC -> STX` fulfill
6. explorer updates for pending, fulfilled, and reclaimed states

## Manual checks before Mainnet

Before Mainnet activation, recheck:

1. the release contract principal
2. the frontend Mainnet environment
3. the quote endpoint response
4. operator liquidity funding
5. wallet post conditions in the signing flow

## Useful references

1. `/Users/apple/Downloads/silentBTC/docs/MAINNET-DRESS-REHEARSAL.md`
2. `/Users/apple/Downloads/silentBTC/docs/MAINNET-RELEASE-CHECKLIST.md`
