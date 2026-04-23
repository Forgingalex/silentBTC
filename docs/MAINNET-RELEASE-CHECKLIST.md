# Mainnet Release Checklist

## Contract

- [x] `silent-bridge-mainnet.clar` passes `clarinet check`
- [x] `silent-bridge-mainnet.test.ts` passes
- [x] release source is frozen for audit handoff
- [x] final mainnet contract name is confirmed
- [ ] final deployer principal is confirmed

## Frontend

- [ ] `NEXT_PUBLIC_STACKS_NETWORK=mainnet`
- [ ] `NEXT_PUBLIC_CONTRACT_ADDRESS` points to the deployed `silent-bridge-mainnet`
- [ ] `NEXT_PUBLIC_CONTRACT_NAME=silent-bridge-mainnet`
- [x] Mainnet UI exposes only `STX <-> sBTC`
- [x] minimum receive is required before submit
- [x] strict post conditions are visible in wallet confirmations

## Solver operations

- [x] solver uses pre funded contract liquidity
- [x] solver enforces user `min-output-amount`
- [x] operator key custody is documented
- [x] liquidity top up and withdrawal procedure is documented
- [x] rollback plan exists if the solver must be paused

## Audit and release

- [x] external audit brief is shared
- [x] internal review is documented
- [x] audit findings are resolved or explicitly accepted
- [x] release notes include residual trust assumptions
- [x] testnet dress rehearsal completed on the release track contract
- [x] explorer shows pending, fulfilled, and reclaimed states correctly
- [x] pricing and solver policy are published
- [ ] team signs off on Mainnet activation
