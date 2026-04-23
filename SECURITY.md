# Security Policy

silentBTC handles transaction construction for real Stacks Mainnet assets. Treat every change to contract calls, post-conditions, token principals, and deployment configuration as security-sensitive.

## Supported Scope

- `stacks-contracts/contracts/silent-bridge.clar`
- `stacks-contracts/contracts/usdcx-token.clar`
- `frontend/src/lib/stacks-config.ts`
- `frontend/src/components/DemoBridge.tsx`
- Deployment configuration under `stacks-contracts/deployments/` and `stacks-contracts/settings/`

## Reporting

Do not open public issues for suspected fund-loss bugs. Share a private report with:

- affected contract/function
- reproduction steps
- impact and affected assets
- suggested mitigation, if known

## Release Requirements

Before any Mainnet deployment:

- `clarinet check` must pass.
- `npm test` in `stacks-contracts` must pass.
- `npm run build` in `frontend` must pass.
- Mainnet USDCx must be a verified SIP-010 principal or the local issuer must receive a separate audit.
- Contract source must not include mock tokens or unrestricted mint functions.
- Frontend transactions must include exact STX, sBTC, or USDCx post-conditions.
- Testnet deployment must be exercised with the same contract source planned for Mainnet.
