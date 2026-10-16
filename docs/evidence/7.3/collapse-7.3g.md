# PLAN 7.3g: what founds the nations after year 30 (probe, 2026-10-16)

Probes in `.cache/73g/`: `probe.ts` (each year's foundings by cause and deaths by kind, the 1938
world, every `RevoltSpawned` classed: *revived* when a `NationRevived` of the same id is in the
tick, *collapse* when its holder's `NationCollapsed` is, else *revolt*, by the people of the land:
the holder's own core, another living nation's, or a dead or no nation's) and `trace.ts` (a
nation month by month from a checkpoint: gold, gross, expenses, army upkeep, warheads,
formations, bankruptcy). Before: HEAD `9ceedc5`; after: ADR-439. The probe's living count is the
sweep's (`landStandings`), and matches `docs/sweeps/2026-10-16-sweep-b1-501.md` year by year.

## Foundings and deaths, years 31–50

| | 501 before | 501 after | 506 before | 506 after |
|---|---|---|---|---|
| collapses | 12 | 0 | 6 | 0 |
| founded by a collapse | 47 | 0 | 34 | 0 |
| revived in a collapse | 1 | 0 | 0 | 0 |
| revolt, the holder's own core | 6 | 24 | 9 | 3 |
| revolt, a dead nation's core | 9 | 23 | 4 | 13 |
| revived by a revolt | 9 | 9 | 2 | 10 |
| eliminated / annexed | 41 / 14 | 32 / 7 | 50 / 15 | 34 / 11 |
| alive in years 30 / 50 (most after 30) | 86 / 115 (115) | 83 / 93 (93) | 96 / 93 (124) | 71 / 63 (76) |
| break-up (living over the most 20 years before; bound 1.1) | × 1.16 | × 0.94 | × 1.27 | × 0.87 |

The rises of the sweep's report are collapses: seed 506 82 → 96 → 124 in years 29–31 (the
Soviet Union, 14 and 25 states in two collapses, 1 to 49,518 cells each), seed 501 80 → 102 in
years 34–36 (the Soviet Union, 20 states at 35.44) and 96 → 115 in years 43–50 (France, six
collapses).

## Why they collapsed: the warheads' upkeep

A collapse is six months running bankrupt (gold under −3 months of gross). Each collapsing nation
was a nuclear power whose stockpile cost more than its income, with no army left to disband:

- Seed 506, the Soviet Union, years 26–31: 71 → 77 warheads built while its gross fell from 1,884
  to 1,226 (the build asked only for the day's gold); expenses 961 → 731 of which army upkeep 126
  → 19 and warheads 710–770. Its last six formations disbanded at 28.77; gold 5,731 → −3,231;
  bankrupt at 29.60, collapsed at 29.93 (14 states) and at 30.60 (25), gross then 155.
- Seed 501, the Soviet Union, years 30–36: 66 warheads (660 a month), gross 814 → 290, expenses
  790, army upkeep 31; collapsed at 34.11 and 35.44 (20 states).
- Seed 501, France, years 40–46: 68 warheads (680), gross 423 → 278, expenses 794 → 741, army
  upkeep 53 → 34; collapsed at 42.28, 44.28, 44.95, 45.53 and again: a collapse voids the debt,
  and the stockpile's upkeep put it under the bankruptcy line again within six months.

The economic AI cut the army and the fleets when short, never the stockpile; the build took only
the day's share of a warhead's price, whatever its upkeep.

## The quick sweep (seeds 1–10 × 30 years, after; `quick-7.3g.md`)

Limits 10 of 10; riser, faller and break-up 10 of 10; no stasis 9 of 10 (seed 4: 20 years).
Warheads at the end 135–165 a seed in 4–6 nations (`quick-7.3e3.md`: 260–371); nukes used in 4
of 10 seeds, 21 bursts (before: 5 of 10, 22).

## Not taken here

- Why a great land's gross falls so: seed 506's Soviet Union lost 18% of its cells in years
  26–30, before its first collapse, and 72% of its gross (1,884 → 526) (occupation, unrest, the land it holds against the land it owns).
- A collapse founds a state for every connected restless group, of 1 cell too, with none of the
  claimant or kin steps of a revolt (7.3d's); with no collapse in these runs it was not measured.
