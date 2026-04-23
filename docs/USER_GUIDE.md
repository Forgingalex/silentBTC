# User Guide

## What silentBTC does

silentBTC lets you move between `STX` and `sBTC` through an intent flow on Stacks.

You choose:

1. the asset you want to send
2. the asset you want to receive
3. the amount
4. the minimum amount you are willing to accept
5. a routing preference

Then you sign the transaction in your wallet. A solver can fulfill the intent if it can meet your minimum output. If the intent remains pending, you can reclaim escrow.

## Supported routes

Mainnet release scope:

1. `STX -> sBTC`
2. `sBTC -> STX`

## Before you begin

You need:

1. a compatible Stacks wallet, usually Leather
2. the asset you want to send
3. enough balance for network fees

## How to create an intent

1. Connect your wallet
2. Choose a route
3. Enter the amount you want to send
4. Enter the minimum amount you are willing to receive
5. Choose `Fastest` or `Cheapest`
6. Submit the intent and approve it in your wallet

## What to look for in the wallet

Before signing, confirm:

1. the contract principal is correct
2. the function name matches the route you selected
3. the post condition shows the exact amount leaving your wallet

Do not approve a transaction if the contract principal or debit amount looks wrong.

## What happens after submission

Your intent appears in the explorer with a pending state.

Possible outcomes:

1. `Privacy Shielded`
   The intent is pending
2. `Fulfilled`
   The solver met your minimum output and completed the swap
3. `Reclaimed`
   The pending intent was canceled and the locked asset returned

## Reclaiming escrow

If your intent has not been fulfilled, you can reclaim it.

1. Open the app
2. Find the pending intent
3. Use the reclaim action
4. Approve the reclaim transaction in your wallet

## Operator tools

The testnet build includes operator controls for rehearsal and support work.

They are used to:

1. fund contract liquidity
2. fulfill pending intents
3. reclaim pending escrow during tests

These tools are operational controls, not public user actions.

## Explorer

The Silent Explorer shows:

1. route
2. amount
3. minimum receive value
4. current state
5. links to the transaction and any resolution transaction

## If something looks wrong

Stop and verify:

1. the contract address
2. the route
3. the exact debit post condition
4. the minimum output value

If an issue affects funds or contract behavior, use the process in `/Users/apple/Downloads/silentBTC/SECURITY.md`.
