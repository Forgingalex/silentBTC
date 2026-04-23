# Contributing

## Workflow

1. Keep changes scoped to one protocol or frontend concern.
2. Run the relevant tests before handing off.
3. Update docs when changing public functions, deployment settings, or post-condition logic.

## Code Standards

- Clarity code must stay small, decidable, and easy to audit.
- Frontend transaction calls must be explicit about network, contract address, function, arguments, and post-conditions.
- Do not add mock assets to production contracts.
- Do not store secrets or deployer mnemonics in the repository.

## Required Checks

```bash
cd stacks-contracts
clarinet check
npm test

cd ../frontend
npx tsc --noEmit
npm run build
```
