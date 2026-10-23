# PLAN 7.86 — what raised the bursts (read only)

Critic run 12: bursts on the same 24 seeds 188 → 497 (×2.6), run 11 on `dd3b730`, run 12 on `896ff779`.
The question of the AT: more wars, more warheads, or the rule.

## The run

`tools/diag/nukeVolume.ts <seed> 30` (new, read only; only APIs `dd3b730` has too), daily from 1938 over
30 years, on the first 12 of the critic's same-24 seeds (1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861,
6421, 7019, 7583, 8167), in three trees:

- **old**: `dd3b730` (run 11's code), in a worktree;
- **rule**: HEAD `07c623c7` with `dd3b730`'s `src/sim/systems/nuclear.ts` (the five nuclear-rule
  commits since: ADR-599, 600, 610, 629 b, 631; `wars.ts`' field of ADR-600 left in, unread by the old
  rule). It compiles against HEAD's `src/`;
- **head**: HEAD `07c623c7` (run 12's code and every commit since, 7.91 and 7.90g among them).

old → rule is the world's part, rule → head the nuclear rule's. Rows: `<tree>_nv_<seed>.json`; the
table: `volume.py` → `volume.txt`.

**Check:** old's bursts are 85, the critic's run-11 count on these 12 seeds (`critic/c11_summary_all.txt`),
seed by seed: the runs are the critic's worlds.

## The read

| Tree | Bursts (a world) | Decided | Civ > 10 × men | ≥ 1 M civilians | Worlds with a burst | Wars declared a world | Holder-years a world | Their share at war | Holder-years at war a world | Stock a holder-day at war | Warheads built a world | Bursts per 1,000 holder-days at war |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| old | 85 (7.1) | 87 | 26 | 1 | 6 | 269 | 95.0 | 0.69 | 65.8 | 21.4 | 160 | 0.29 |
| rule | 190 (15.8) | 195 | 37 | 5 | 12 | 436 | 93.1 | 0.82 | 76.1 | 21.3 | 171 | 0.57 |
| head | 213 (17.8) | 219 | 34 | 4 | 12 | 444 | 93.0 | 0.81 | 74.9 | 21.3 | 170 | 0.65 |

By ten-year third (bursts; holder-years at war a world; bursts per 1,000 holder-days at war):

| Years | old | rule | head |
|---|---|---|---|
| 1–10 | 3; 3.7; 0.18 | 3; 3.4; 0.20 | 3; 3.4; 0.20 |
| 11–20 | 19; 31.7; 0.14 | 72; 32.6; 0.50 | 70; 31.2; 0.51 |
| 21–30 | 63; 30.4; 0.47 | 115; 40.1; 0.65 | 140; 40.4; 0.79 |

## The cause

Bursts ×2.51 (85 → 213), the critic's ×2.6:

- **More warheads: no.** Holder-years ×0.98, the stock a holder holds at war the same (21.4 / 21.3),
  warheads built 160 → 170 a world.
- **More wars: a little.** Holder-days at war ×1.16 (the holders' share of days at war 0.69 → 0.82),
  all of it in years 21–30 (30.4 → 40.1 holder-years at war); wars declared 269 → 444 a world.
- **The nuclear rule since `dd3b730`: not distinguishable from zero on 12 seeds.** rule → head ×1.12
  overall, the seeds both ways (1307 35 → 29, 5309 19 → 8; 4219 7 → 16, 5861 13 → 30). Civilian
  bursts 37 → 34 and a million or more 5 → 4: the same or fewer.
- **What is left, ×1.93, is the same old rule firing twice as often a holder-day at war in HEAD's
  world.** Years 11–20 say it alone: holder-years at war 31.7 against 32.6, bursts 19 against 72, both
  under `dd3b730`'s nuclear rule. It is the wars' character, not their number: which of the decision's
  inputs moved (desperation, the place's value, the chance through, the strike back weighed) is not
  read here.

Interception unchanged: 97–98 % of decisions burst in every tree.

## Civilians

The two halves of the critic's objection move apart. The share of bursts killing over ten times more
civilians than men fell, 31 % → 16 % (26 / 85 → 34 / 213); their count rose with the volume, 26 → 34, and
bursts of a million civilians or more 1 → 4. Worlds with a burst 6 → 12 of 12 (the critic's 14 → 23 of
24): the spread is what the critic calls a habit.

## What it means for the AT

The AT's bar (on 10 unseen seeds × 30 years bursts a world and civilian bursts not above `dd3b730`'s)
cannot be met by the nuclear rules since `dd3b730`: with them taken out the world bursts 190 against 85.
Meeting it needs a new rule against the rate a holder-day at war, a rule against the busier war's
effect that the critic's R12-B1 asked for, or the user's acceptance of the volume (ADR-657).
