# PLAN 7.3d3: what still breaks the world up (probe, 2026-10-16)

A probe of the 1938 world on `f343136` (after ADR-432), 30 years, seeds 5, 1 and 6 (break-up ×
1.49, × 1.22 and × 1.14 in `quick-7.3d2.md`). Each row is a count by year, years 1 to 30. A
nation is *founded* when its `people` is another nation's (`isFounded`), *1938* when it is of the
scenario. "Holder core": a revolt that founded a state on its holder's own core land (`people` =
the holder). "Core dead": on the land of a dead core nation with no kin next to it.

## Seed 5

| | 1–10 | 11–18 | 19 | 20 | 21 | 22 | 23 | 24 | 25–30 |
|---|---|---|---|---|---|---|---|---|---|
| born, holder core | 3 | 5 | 20 | 2 | 12 | 4 | 25 | 6 | 16 |
| born, core dead | 37 | 4 | 0 | 0 | 0 | 0 | 1 | 1 | 8 |
| a revolt joins rebels | 1 | 0 | 1 | 0 | 3 | 5 | 16 | 0 | 1 |
| founded deaths (of them annexed) | 27 (23) | 6 (3) | 3 (2) | 3 (3) | 2 (0) | 2 (2) | 1 (1) | 4 (2) | 13 (8) |
| founded and free, at the year's end | 8 (y10) | 10 (y18) | 26 | 25 | 34 | 36 | 59 | 61 | 73 (y30) |

1938 nations at the end of years 1 / 10 / 20 / 30: free 54 / 48 / 56 / 67, puppets 42 / 31 / 21 / 9.

## Seeds 1 and 6

Born on the holder's core, years 19–30: seed 1: 9, 0, 9, 6, 1, 0, 0, 0, 2, 12, 9, 4; seed 6:
7, 0, 2, 0, 0, 1, 0, 7, 4, 30, 1, 2. Founded and free at the end of years 10 / 20 / 30: seed 1
8 / 18 / 47, seed 6 5 / 11 / 23.

## Who the holders are, and why their core land rose

Each birth on a holder's core, with the holder's share of the world's owned land (km²), whether
a war had its side at exhaustion ≥ 60 ("worn": AT_WAR on far core land, ADR-47), and its wars:

- Seed 5, years 19–21: the Soviet Union, 5.8–11.7% of the land, 32 states (18 in year 19). Worn in an ally's war:
  "CHI(ally) v ENG, day 1,694, exhaustion 100", and its own wars with the rebel states, each
  worn after 600 days (exhaustion grows 0.1 a day). 17–20 formations, 1,900–2,800 gold,
  suppression 0 most months.
- Seed 5, years 22–24: France, 9.2% falling to 3.5%, 35 states (29 in years 22–23). "POR(ally) v CHI, day 1,143–1,509,
  exhaustion 100"; 140–145 formations, 5,000–6,000 gold, suppression 0. France fought nothing in
  that war; the days alone wore it.
- Seed 6, years 26–28: the United Kingdom, 5.4–6%, 33 states, mostly not worn at the birth
  (unrest built while worn and decays slowly).
- Seed 5, years 13–14: the two Spains, under 0.5%, a state each (the civil war's land, claims of
  the other).

Overextension's strain at 4–13% of the land is 0.3–2.0 a month, under the decay of 2 below
10.4% (ADR-57). The AT_WAR of "worn" (+2) makes it rise; it came from the days of the war, not
from what it cost the holder.

## Not taken here

- The AI pays for suppression only with a surplus of 15% of its income, whatever its treasury
  (France, 5,000 gold, suppression 0).
- Founded statelets under 8,500 km² that lose a white peace live on (seed 6, year 28: 14; seed
  5, years 19–30: 20). ADR-432 annexes a founded loser only at |score| ≥ WHITE_PEACE.
- "Born, core alive" in the probe's output matched "revived" year by year: a revived nation's
  `RevoltSpawned`, not a cause.
