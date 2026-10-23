# PLAN 7.96c — the volleys: the fight-for-life strikes are most of them (ruled, not committed; ADR-660)

7.96's bar (ADR-658 b, the user's): on 10 unseen seeds × 30 years, the share of bursts by a striker within
30 days of its own last, and the share of civilian bursts (over ten times more civilians than men), not
above `dd3b730`'s; bursts a world reported.

## The A/B (four of 7.86's seeds × 30 years, `nukeVolume.ts`; `c-ab.txt`)

STRIKE_GAP_DAYS (a side's wait after its burst before its next first use in the war) 7 → 30 and 60, one
constant, worktrees on `3db592ac`. Rows `c-ab-g30_nv_*`, `c-ab-g60_nv_*`; HEAD's and `dd3b730`'s 7.86's,
TABOO_AFTER 0.6 7.96b's.

| Tree | Bursts | Within 30 d of its own last | Within 60 d | Civ > 10 × men | ≥ 1 M civilians | Strikers a world | Longest chain (≤ 60 d) |
|---|---|---|---|---|---|---|---|
| dd3b730 | 12 | 1 (8%) | 1 (8%) | 4 (33%) | 0 | 1.5 | 2 |
| HEAD | 122 | 42 (34%) | 47 (39%) | 19 (16%) | 2 | 4.0 | 10 |
| gap 30 | 110 | 26 (24%) | 38 (35%) | 15 (14%) | 1 | 3.5 | 15 |
| gap 60 | 120 | 9 (8%) | 29 (24%) | 21 (18%) | 2 | 3.2 | 12 |
| taboo 0.6 | 97 | 27 (28%) | 28 (29%) | 15 (15%) | 1 | 3.8 | 3 |

## The unseen seeds (811–820 × 30 years; `c-unseen.txt`)

`dd3b730` (`base-dd3b730_nv_*`), HEAD `3db592ac` (`c-head_nv_*`), the flat 60 days (`c-g60_nv_*`), and 60
days with a nation in extreme desperation keeping the week (`c-rule_nv_*`, `c.patch`):

| Tree | Bursts | Within 30 d of its own last | Within 60 d | Civ > 10 × men | ≥ 1 M civilians | Strikers a world | Longest chain (≤ 60 d) |
|---|---|---|---|---|---|---|---|
| dd3b730 | 91 | 26 (29%) | 29 (32%) | 29 (32%) | 0 | 2.0 | 4 |
| HEAD (7 days) | 244 | 75 (31%) | 95 (39%) | 31 (13%) | 3 | 4.1 | 8 |
| gap 60 flat | 276 | 15 (5%) | 52 (19%) | 44 (16%) | 4 | 4.1 | 5 |
| 60, extreme 7 | 256 | 76 (30%) | 96 (38%) | 37 (14%) | 4 | 4.3 | 8 |

- **The flat 60 days meets the bar** (volleys 5 % against 29 %; civilian share 16 % against 32 %), and
  turns `nukeStrikeAgain1938` red: the critic's France of R7-B1 (PLAN 7.6d, seed 2604, fighting to the
  death, overrun) strikes once in 90 days where the test asks for a second within 30 days of the first.
- **With the week kept for a nation in extreme desperation** (`desperationOf`'s extreme: fighting to the
  death, or its capital threatened or taken, and desperation at least 1) the test is green (France on
  days 33, 40, 51, 77, 86) and the volleys are back: 30 % against the bar's 29 %. So the volleys on these
  seeds are mostly the strikes of nations fighting for their lives.

The two critic findings pull apart: R7-B1 (a France fighting for its life held its warheads 49 days:
too restrained) and run 12 (strikes in volleys: a habit). Which wins is the user's (ADR-660). Neither
rule is committed: `c.patch` holds the second (EXTREME_GAP_DAYS 7; the first is the same with
EXTREME_GAP_DAYS 60), its test and SPEC's line. The pin is unchanged by either (7098dd29: seed 99's first
year has no second strike within 60 days).
