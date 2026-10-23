# PLAN 7.90: the AT, read after 7.90b–h

HEAD `26d917d3` (7.90b–f and h in; 7.90g held in `g.patch` on ADR-651), and HEAD with `g.patch`'s
`src/` hunks applied for the read alone (reverted after). Run 12's saves (`critic/c12_seed*.bin`).

## 1. The bar

Piles of 30 or more of a nation at war on one cell 30 days running on 1129 year 10, 6421 year 20 and
7019 year 10 (`tools/diag/piles.ts`, 30 days): **2 → 0**. Read: **2 → 2. Missed.**

| save | HEAD (`at_piles.json`) | HEAD + g.patch (`at_piles_g.json`) |
|---|---|---|
| 1129 year 10 | USA 60 at 625163 (by Chicago, front 198 cells), 53 at 746057 (by Baltimore, 148) | the same |
| 6421 year 20 | none 30 days (the 74–77 boarded from day 4; longest 9 days) | none |
| 7019 year 10 | none | none |

## 2. The two piles by day (`tools/diag/pileDaily.ts`, 90 days; `at_daily_1129.log`, `…_g.log`)

| day of 90 | 0 | 10 | 20 | 30 | 60 | 65 | 80 | 85 |
|---|---|---|---|---|---|---|---|---|
| Baltimore pile, HEAD | 53 | 45 | 33 | 31 | 31 | 25 | 14 | 7 |
| Baltimore pile, + g.patch | 53 | 45 | 33 | 31 | 31 | 27 | 10 | 6 |
| Chicago pile, either | 60 | 60 | 60 | 60 | 60 | 60 | 60 | 60 |

Against 7.89's read (53 → 41 by day 30, 60/43 on day 90 at 7.90a), the ferry now carries the Baltimore
pile off: 7 left on day 85. It stands at 31 from day 30 to day 60 while the groups are away (one round
trip of about four weeks), one division over the bar. `g.patch` does not move day 30 (its trips of one
were Norfolk's split of the day-3712 turn, after day 30).

The 60 by Chicago do not move in 90 days on either code: the ferry sends the free army nearest a port
with a group, and the 60 (121 cells from the nearest sea port, `a.md` §6) are never that while the
Baltimore pile stands.

## 3. Why the bar is out of reach on these saves

Both piles were built before the save, by the code of run 12 (`896ff779`), when the ferry carried none
of the mainland's army (ADR-636 to ADR-652 since). From the saved day, any rule must move 31 of the 60
off their cell within 30 days: a march to the Atlantic ports is 121 cells at 1.4–2.1 cells a day (58–86
days), and the USA's 12 groups order at most 12–24 divisions off in 30 days (`a.md` §6; about 26 groups
needed). Neither a march nor more transports (trained over months) does it from this save. Whether
the rules of HEAD build such a pile from 1938 is 7.79's AT clause ("no pile of 30 or more divisions of a
nation at war in one place for 30 days" on 10 unseen seeds × 20 years), which reads it from the start.

## 4. Verdict

7.90 missed its bar (2 → 2); BLOCKERS 2026-10-23. The bar's scope is the user's (ADR-653): (a) the
piles on fresh worlds are judged by 7.79's AT, and the critic's saves are a measure of the lift, not a
bar; (b) PLAN 7.93, the far army staged at the ports with a group before the lift (a bar over 90 days);
(c) PLAN 7.93 as more transports, the want sized to the far army.
