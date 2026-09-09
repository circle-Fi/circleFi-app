# CircleFi - the app

A rotating savings circle you can actually run: open one, join one, pay your
round, take your turn. Everything happens on Stellar.

There is no CircleFi server. The app is a React build that runs entirely in the
browser and talks straight to a public Soroban RPC node and to your wallet - so
nobody holds your money, there is nothing to go down on the day your payout is
due, and there is no database of members to leak. The contract is the backend.

**Live:** https://circle-fi.github.io/circleFi-app/ - mirror: https://circle-fi-app-8dgi.vercel.app/

## What it does

- **Browse** every circle the factory has opened, with live state read straight
  from the ledger. No wallet needed to look.
- **Start a circle**: pick the token, the amount per round, the number of
  members and how long a round lasts. The page states the deal in words before
  you sign anything.
- **Join**: locks one round's worth as a security deposit.
- **Contribute** each round, **top up** a deposit that has been drawn down,
  and **settle** a round once everyone has paid or the window has closed.
- **Withdraw** your deposit when the circle completes.

If a member misses a round, their deposit covers it, so whoever's turn it is
still gets paid in full. When a deposit runs out the pot comes up short and the
app says so plainly rather than hiding it.

## Running it

```sh
npm install
npm run dev
```

You need [Freighter](https://freighter.app) and a funded testnet account for
anything that writes. Reads work without either.

## Where it points

```
factory   CCJRXTYIEFE6Z7DGTAKRGBLOGYBZNOONHI7FWZUDXEKZ7LGEGZNXKG3M
network   Test SDF Network ; September 2015
rpc       https://soroban-testnet.stellar.org
```

Override the factory at build time with `VITE_FACTORY_ID`.

The contracts live in
[circle-Fi/circleFi-contract](https://github.com/circle-Fi/circleFi-contract).

## Layout

| file | what it holds |
| --- | --- |
| `src/chain.js` | every call to Stellar; contract errors turned into sentences |
| `src/format.js` | token amounts and durations, in integers - no float drift |
| `src/App.jsx` | the three screens and the wallet |

## Licence

Apache-2.0
