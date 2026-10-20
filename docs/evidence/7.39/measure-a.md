# PLAN 7.39a: why the war at sea stops after year 1, measured (critic R10-B2)

At HEAD `63ba0e4`, from 1938, the critic's 14 seeds (1307, 2081, 2953, 3613, 4219, 4877, 5309,
5861, 6421, 7019, 7583, 8167, 8693, 9437) × 30 years. No rule: the pin is unchanged.

- `npx tsx tools/diag/seaYears.ts <seed> 30` (7.35d1's tool): sea battles, sinking, fleets, pairs a
  day. JSON in `a/years_<seed>.json`.
- `npx tsx tools/diag/seaWars.ts <seed> 30` (new): weekly at 01:00, each war's sides by navy, and
  every armed fleet of a nation at war: under way, in a battle, or what the naval AI's `plan` and
  `awayOrder` do with it (`tools/diag/seaWhy.ts`, new, a copy of their tests in their order); for a
  fleet on station at war with a navy, why the nearest enemy fleet is not hunted; fleets' orders
  refused (`MoveRejected`). JSON in `a/wars_<seed>.json`.
- Tables: `node docs/evidence/7.39/a/sum.mjs` → `a/summary.md`.

## 1. The bar's figures at HEAD (the "before" of 7.39's AT)

| all 14 seeds, mean a world-year | year 1 | years 2–30 | 2–5 | 6–10 | 11–30 |
| --- | --- | --- | --- | --- | --- |
| sea battles | 35.7 | 4.3 | 7.1 | 5.6 | 3.4 |
| that sank a ship | 35.0 | 4.2 | 6.9 | 5.5 | 3.3 |
| ships sunk | 356.1 | 44.9 | 97.6 | 61.1 | 30.3 |
| armed fleets (a day) | 96.1 | 73.3 | 80.8 | 71.1 | 72.4 |
| nations with a navy (a day) | 16.0 | 16.7 | 14.3 | 16.7 | 17.1 |

- 7.39's first bar, a quarter of year 1: 8.9 a world-year; HEAD has 4.3 (× 2.1 short). The critic's
  2.7 was read at `bcbc99c` from `rows[].sea` of its own headless runs; HEAD's year 1 on 1307 has 33
  rows against the critic's 41 (the nuclear rules since, PLAN 7.38 to 7.45, move the worlds).
- 7.39's second bar, at most 5 % of the late battles sinking nothing: 45 of 1,746, 2.6 % (met at
  HEAD; per seed 0 % to 7.3 %, 7019 the highest, 11 of 150).

## 2. The wars' sides by navy (read, not a bar: which nations go to war is diplomacy's)

War-weeks a world-year (a war counted each week it runs):

| | year 1 | years 2–30 | 2–5 | 6–10 | 11–30 |
| --- | --- | --- | --- | --- | --- |
| both sides a navy | 68.5 | 63.4 | 73.9 | 72.3 | 59.1 |
| a navy against a coast it reaches | 200.8 | 125.4 | 189.8 | 129.3 | 111.6 |
| a navy against no coast it reaches | 13.4 | 24.6 | 23.7 | 22.4 | 25.3 |
| neither a navy | 60.1 | 58.9 | 87.7 | 79.4 | 48.1 |

A war of two navies runs as often late as in year 1 (63.4 war-weeks a world-year against 68.5),
and on 23 to 29 of the 29 late years of every seed. The critic's "18 of 28 samples with no war of
two navies" (two days, years 10 and 20, at `bcbc99c`) is not what HEAD's weekly read finds: the
wars are there; the battles are not.

## 3. Where the fleets are (fleet-weeks a world-year, nations at war with a navy)

| | year 1 | years 2–30 | 2–5 | 6–10 | 11–30 |
| --- | --- | --- | --- | --- | --- |
| under way | 95.8 | 23.8 | 33.7 | 25.6 | 21.3 |
| in a sea battle | 3.8 | 0.2 | 0.4 | 0.3 | 0.2 |
| at port, a target to sail for (`take`) | 141.1 | 37.1 | 72.8 | 65.6 | 22.8 |
| at port, staging | 13.9 | 4.5 | 5.2 | 5.3 | 4.2 |
| at port, nothing in reach, no forward base | 2.4 | 34.1 | 18.9 | 20.5 | 40.5 |
| at port, the enemy too strong | 4.9 | 0.6 | 1.1 | 1.6 | 0.3 |
| at port, empty water under bombers | 0 | 0.6 | 0 | 0.3 | 0.8 |
| away, an enemy fleet to hunt | 125.6 | 16.1 | 34.3 | 26.5 | 9.9 |
| **away, on station at an enemy port** | **1,463.4** | **901.0** | 1,695.3 | 1,267.7 | 650.5 |
| away, a new station | 16.9 | 5.7 | 15.9 | 9.6 | 2.7 |
| away, sent home | 39.0 | 5.6 | 10.3 | 11.1 | 3.3 |

Fleets on station at war with a navy, why the nearest enemy fleet is not hunted:

| | year 1 | years 2–30 | 2–5 | 6–10 | 11–30 |
| --- | --- | --- | --- | --- | --- |
| **of its waters, beyond `SORTIE_KM` (2,500 km)** | **1,402.4** | **886.4** | 1,657.2 | 1,247.1 | 642.1 |
| none of its waters | 28.2 | 6.8 | 26.8 | 10.4 | 1.8 |
| under way or in a battle | 12.8 | 2.9 | 3.3 | 2.8 | 2.9 |
| its zone's enemy over the fleets together | 19.5 | 4.8 | 7.7 | 7.3 | 3.6 |
| huntable (a fleet whose AI day has not come) | 0.6 | 0.1 | 0.3 | 0 | 0.1 |

Fleets' orders refused (`MoveRejected`), years 2–30: 1,756 in 406 world-years, all `NoSeaWay`
(4.3 a world-year).

The fleets of nations at war with a navy stay out, not in port: 87 % of their late fleet-weeks are
on station at an enemy port (the blockade, `awayOrder`), and for 98 % of those the nearest enemy fleet
in the same waters is farther than a sortie's reach. Most such fleet-weeks are Japan's (125,620 of
the 14 seeds' station weeks), the United States' (82,589), Britain's (58,507) and France's (23,801).
A fleet that has taken a station keeps it while it is by an enemy port (`awayOrder`: no battle in
reach, `onStation`), and its first sortie took the nearest enemy port it could win, not the enemy
navy's. The navies at war with each other blockade the ports nearest them, of the enemy or of its
partners, and stand thousands of km apart until peace. Year 1 has the same shape (1,402 such weeks),
but its wars begin with the fleets at their home ports, and its 126 hunts a world-year (16 late)
are the battles' likely source (a reading, not measured here).

## 4. What is not the cause

- Orders refused: 4.3 a world-year.
- Ports with no target, the enemy too strong, empty water under bombers: 35 fleet-weeks a
  world-year together, 3 % of the late fleet-weeks at war with a navy.
- A navy's wars with nations that have none (the coast row, 125 war-weeks a world-year) do not
  hold the navies from a navy's war: a fleet at war with a navy is counted in §3 wherever it stands.
- Too few navies: 16.7 nations a day have an armed fleet late, as in year 1 (16.0), after 7.35d3b.

## 5. The cause, and the part it is for

The navy's war stands still because its fleets stay on a blockade station beyond the reach of the
enemy's fleets (886 fleet-weeks a world-year of 1,029 at war with a navy). PLAN 7.39b: measured
first, for those fleet-weeks, how far the enemy fleet is and where it stands (its own port, a
station, of which war), and whose port the station is; then a rule with an ADR.
