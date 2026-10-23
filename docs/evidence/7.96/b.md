# PLAN 7.96b — the taboo after a burst, A/B (missed)

7.96a (`a.md`) read that 17 of 23 strike days in HEAD's world pass the floor only with the world's taboo
broken by an earlier burst, and first order that TABOO_AFTER 0.6 would keep 8 of 23. Here the live A/B.

## The run

`tools/diag/nukeVolume.ts <seed> 30` on HEAD `c42d3eca` with TABOO_AFTER 0.6 and 0.7 (one constant,
worktrees), seeds 1307, 2953, 3613 and 5861 (four of 7.86's twelve, the most bursts on HEAD). HEAD's and
`dd3b730`'s rows are 7.86's (`docs/evidence/7.86/head_nv_*.json`, `old_nv_*.json`; HEAD's sim is
`c42d3eca`'s). Rows: `b-t06_nv_*.json`, `b-t07_nv_*.json`.

| Seed | `dd3b730` | HEAD | TABOO_AFTER 0.6 | 0.7 |
|---|---|---|---|---|
| 1307 | 3 / 0 | 29 / 4 | 19 / 4 | 28 / 5 |
| 2953 | 0 / 0 | 27 / 2 | 22 / 2 | 25 / 7 |
| 3613 | 0 / 0 | 36 / 4 | 23 / 6 | 29 / 7 |
| 5861 | 9 / 4 | 30 / 9 | 33 / 3 | 19 / 3 |
| **Four** | **12 / 4** | **122 / 19** | **97 / 15** | **101 / 22** |

(bursts / civilian bursts, over ten times more civilians than men.)

Volleys (the same striker again within 30 or 60 days of its last burst; strikers a world; the longest
chain of a striker's bursts each within 60 days of the one before):

| | Bursts | Within 30 d | Within 60 d | Strikers a world | Longest chain |
|---|---|---|---|---|---|
| `dd3b730` | 12 | 1 (8 %) | 1 (8 %) | 1.5 | 2 |
| HEAD | 122 | 42 (34 %) | 47 (39 %) | 4.0 | 10 |
| 0.6 | 97 | 27 (28 %) | 28 (29 %) | 3.8 | 3 |
| 0.7 | 101 | 31 (31 %) | 35 (35 %) | 3.5 | 9 |

## The read

- **Volume:** −20 % (0.6) and −17 % (0.7), seeds both ways (5861 30 → 33 at 0.6). `dd3b730` has 12. 7.96's
  bar is about a tenth of what the rule leaves: out of reach by this constant.
- **Volleys:** 0.6 cuts the chains (longest 10 → 3, within 30 days 42 → 27), 0.7 hardly (9, 31). The two
  are not in order, so on four seeds the cut is not told from noise.
- **Why the first order did not hold:** 7.96a's gain is over the floor on 3,508 and 4,050 holder-war-days
  in HEAD's world. A dearer taboo holds a strike on its day; it does not take away the desperation and
  the value that put the gain there, so the strike comes later or in the next war. In a live world
  the taboo is a delay, not a block. `a.md`'s TABOO_AFTER table is per day read alone and is not a
  forecast.
- **The trigger** (desperation 0.6–1.3 from nations overrun, places of value 0.8–1.0) is the land war's.
  A rule that holds it holds the fight-for-life strike of SPEC §6.4: a doctrine change.

## `dd3b730` on unseen seeds 811–819 × 30 years (the base for any bar the user keeps)

`base-dd3b730_nv_*.json`: 89 bursts (811 0, 812 5, 813 6, 814 0, 815 1, 816 6, 817 8, 818 35, 819 28),
civilian bursts 28. Seed 820 did not run: its runner was stopped for low memory before it began.

No rule; the pin unchanged (7098dd29).
