# PLAN 7.142's AT: the wing rebuild at war keeps the war's reserve, on 1243–1252 × 20 years

2026-10-27. HEAD `6f5b2c83` (sim as `5f1eab92`, from a worktree) against the rule (ADR-736), `tools/diag/airWar.ts`
four of each arm at a time, files in `.cache/7142/at_head` and `.cache/7142/at_rule`.

## The read first (`tools/diag/airForce.ts`, 1171, 1174, 1177, 1180, years 1–9 of HEAD)

Late, 10–15 wings built a world-year against 10–20 lost; wings 57–81 from 133–166 at the start (year 1 loses
89–157, nearly all in the air). Of the gated months of nations at war under their air share, the largest gate is
`goldPriceHeld` (60–117 a year: the wing's price in the treasury, the three months of income past it not), then
`gold` (25–94), then `noAirfield` (5–81, growing). Losses late are in the air (`inAir`), not bases taken or
nations dead: more building is what lifts the count.

## The rule on the spent seeds (1171, 1174, 1177, 1180 × 20)

| | HEAD | rule | × |
|---|---|---|---|
| year 1 aloft | 55.25 | 57.08 | 1.03 |
| years 2–20 aloft | 17.20 | 25.32 | 1.47 |
| years 2–20 wings | 64.24 | 114.18 | 1.78 |
| years 2–20 air battles a year | 237 | 638 | 2.69 |

## The AT (unseen 1243–1252)

| seed | 1243 | 1244 | 1245 | 1246 | 1247 | 1248 | 1249 | 1250 | 1251 | 1252 | mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| year 1 aloft, HEAD | 62.8 | 52.0 | 52.1 | 56.7 | 57.3 | 53.2 | 51.1 | 57.0 | 56.7 | 37.6 | 53.65 |
| year 1 aloft, rule | 64.0 | 50.6 | 52.7 | 52.9 | 55.0 | 53.5 | 52.1 | 56.6 | 57.8 | 37.3 | 53.25 |
| years 2–20 aloft, HEAD | 20.8 | 18.5 | 20.8 | 19.1 | 16.9 | 17.0 | 21.5 | 25.1 | 19.2 | 25.6 | 20.43 |
| years 2–20 aloft, rule | 25.1 | 27.4 | 25.6 | 30.3 | 33.9 | 30.9 | 29.7 | 31.5 | 29.5 | 33.4 | 29.73 |
| years 2–20 wings, HEAD | 84.2 | 74.7 | 69.3 | 70.2 | 57.4 | 58.7 | 72.6 | 84.2 | 68.0 | 85.2 | 72.45 |
| years 2–20 wings, rule | 125.2 | 120.9 | 108.5 | 123.7 | 117.2 | 118.9 | 126.1 | 121.6 | 124.2 | 139.3 | 122.57 |
| years 2–20 air battles, HEAD | 325 | 268 | 314 | 260 | 270 | 196 | 344 | 340 | 164 | 411 | 289 |
| years 2–20 air battles, rule | 512 | 504 | 634 | 666 | 709 | 658 | 699 | 919 | 776 | 756 | 683 |

Wings **1.69 ×** (bar 1.2 ×), sorties aloft **1.46 ×** (bar 1.2 ×), year 1 **0.99 ×** (bar 0.9 ×): **met**, higher on
every seed late. The rebuild stops at a nation's start of wings (`world.airStart`) and AIR_REBUILD_SHARE of its
income, as before: the air forces come back toward their 1938 size (~145), not past it. Seeds 1243–1252 spent.

## A wing at sea on its panel (part 1, `6f5b2c83`)

`a-wing-at-sea-row.png`: the Actions tab row of a US fighter group sailing to Britain, "at sea to its new base,
9 days", its order buttons off (`tests/e2e/airOrders1938.spec.ts`).
