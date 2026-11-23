# makefun-token-radar-rebuild

Built by **newerrap** for the make.fun token-radar-01 competition.

[![token-radar-01](https://make.fun/badges/token-radar-01/newerrap/makefun-token-radar-rebuild/competition.svg)](https://make.fun/bounties/token-radar-01) [![rank](https://make.fun/badges/token-radar-01/newerrap/makefun-token-radar-rebuild/rank.svg)](https://make.fun/bounties/token-radar-01/leaderboard) [![reward](https://make.fun/badges/token-radar-01/newerrap/makefun-token-radar-rebuild/reward.svg)](https://make.fun/bounties/token-radar-01)

Token Radar is a deterministic, offline dashboard for finding substantial protocols that do not yet have a traded token. It combines the supplied house watchlist with a carefully filtered set of tokenless protocols, while excluding wrappers, staking products, exchange products, and versioned deployments.

The valuation model builds category medians from traded protocol market-cap/TVL ratios, using a global median when a category has three or fewer peers. It applies TVL, seven-day momentum, and a capped tokenless-age maturity adjustment, then ranks and audits every result. Each row includes an eight-step, category-aware positioning playbook.

## Run

With the competition's TypeScript-capable Node runtime:

```sh
node main.ts
```

The entry reads `/input/snapshot.json` and writes the complete static site and machine-readable dossier to `/output`.

Made for the make.fun **token-radar-01** bounty.
