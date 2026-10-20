# PLAN 7.39b: how a late war of two navies begins, and the chase tried (critic R10-B2)

At HEAD `23a6095`, from 1938. No rule committed: the pin is unchanged. The rule tried is
`b-chase.diff` (ADR-573, not adopted; the user's decision).

- `npx tsx tools/diag/seaStart.ts <seed> 30` (new): each war on the first day its two sides both
  have an armed fleet: each side's fleets by state and by what the naval AI does with them, the km
  between the two sides' nearest fleets; the battles between its sides in 30 and 90 days; each sea
  battle's place, who sailed to it, who lost what. The critic's 14 seeds × 30 years, JSON in
  `b/start_<seed>.json`, tables `node docs/evidence/7.39/b/sum.mjs` → `b/summary.md`.
- `farBase` (new, `tools/diag/seaWhy.ts`, counted by `seaWars.ts` as `far`): for a fleet on station
  whose nearest enemy fleet of its waters is beyond `SORTIE_KM`, whether its bloc holds a port from
  which that fleet is in reach.
- The chase's A/B, 4 seeds (1307, 3613, 8693, 7019) × 10 years, before (HEAD) and after
  (`b-chase.diff`), the two at once: `seaWars`, `seaYears`, `seaStart`; `b/chase/`, tables
  `node docs/evidence/7.39/b/chase/ab.mjs`.
- The AT's run of the chase: the critic's 14 seeds × 30 years, `seaWars` and `seaYears` with
  `b-chase.diff` and its mirror in `seaWhy.ts` (`b-chase-seaWhy.diff`, so that a fleet chasing is
  not read as on station), against 7.39a's run of HEAD (`a/`; the sim unchanged since). JSON in
  `b/full/`, table `node docs/evidence/7.39/b/full/read.mjs`.

`seaStart` counts a battle by its record's first hour: 3.4 a world-year late against `seaWars`'
4.3 (records that begin and end within the hour, or merge, are missed). The bars are `seaWars`'.

## 1. Late wars of two navies begin far apart; in year 1 they begin near

| the critic's 14 seeds | year 1 (a world) | years 2–30 (a world-year) |
| --- | --- | --- |
| wars of two navies begun | 9.6 | 2.4 |
| their battles in the first 90 days, a war | 2.91 | 0.87 |
| with no battle in 90 days | 25 % | 54 % |
| the two sides' nearest fleets of the same waters, median km | 909 | 4,423 |
| beyond `SORTIE_KM` (2,500 km) or of other waters | 28 % | 69 % |
| battles in 90 days, a war begun within `SORTIE_KM` | 3.49 | 1.62 |
| battles in 90 days, a war begun beyond it | 1.42 | 0.52 |

- Late wars of two navies begin 4 × less often (2.4 a world-year against 9.6). Which nations go to
  war is diplomacy's (the user's, 2026-10-20). The rule can only lift the battles a war.
- The fleets' state at the start is not what changed. Fleets on station at a port of another war's
  enemy (`stOther`) are 41 % of year 1's near starts, 60 % of its far ones, 35 % and 47 % late. At
  their bloc's port: 30 % and 18 % in year 1, 22 % and 23 % late (`b/summary.md` §2). Year 1's wars
  also begin with fleets out on stations. What changed is the distance between the two navies.
- 88 % of year 1's battles and 93 % of the late ones have one side that stood (at a port or on
  station) and one that sailed to it. 85 % of year 1's come in the war's first 30 days, 48 % of the late
  ones (§4).

So PLAN 7.39b's "if" holds only in part. Late wars do begin with the navies on stations from
earlier wars, but so do year 1's. The cause is that the navies stand beyond a sortie's reach of each
other, and a fleet on station never seeks a fleet beyond `SORTIE_KM` (`awayOrder`).

## 2. From where the far fleets could reach the enemy (`farBase`)

Of the fleet-weeks on station with the nearest enemy fleet of their waters beyond `SORTIE_KM`,
years 2–10, 4 seeds (47,949):

| | fleet-weeks | share |
| --- | --- | --- |
| a port of its bloc's within `SORTIE_KM` of that enemy fleet | 18,427 | 38 % |
| none | 18,365 | 38 % |
| that enemy fleet's zone stronger than its navy of those waters | 11,157 | 23 % |

A stage to a forward base near the enemy navy (`forwardBases` with the enemy's fleets as targets)
could reach 38 % at most, under the AT's half. So the rule tried sails at the enemy fleet itself.

## 3. The rule tried: the chase (`b-chase.diff`)

In `awayOrder`, after a battle in reach and before its station: the nearest standing enemy warfleet
of its waters beyond `SORTIE_KM`, from a zone with no enemy ship, whose zone's enemy power is no more
than the nation's standing warfleets of those waters together (its navy there).

A/B, 4 seeds × 10 years (`seaWars`, the bars' tool; mean a world-year):

| | before | after |
| --- | --- | --- |
| year 1's sea battles (a world) | 37.3 | 50.8 |
| sea battles, years 2–10 | 6.4 | 7.3 |
| on station, the enemy fleet beyond reach, years 2–10 | 1,332 | 12.9 |
| fleets chasing, years 2–10 | – | 13.8 |

| `seaYears`, mean of 4 seeds | year 1 | 2 | 3 | 5 | 8 | 10 |
| --- | --- | --- | --- | --- | --- | --- |
| armed power (k), before | 291 | 259 | 254 | 240 | 186 | 177 |
| armed power (k), after | 217 | 128 | 129 | 114 | 132 | 139 |
| armed fleets, before / after | 94 / 70 | 84 / 43 | 84 / 42 | 82 / 39 | 70 / 44 | 69 / 46 |
| nations with a navy, before / after | 14.9 / 13.5 | 12.6 / 9.7 | 14.2 / 10.0 | 16.0 / 11.9 | 16.5 / 14.6 | 16.8 / 12.5 |
| sea battles, before / after | 37.3 / 50.8 | 6.3 / 12.8 | 5.5 / 5.8 | 11.3 / 5.0 | 5.3 / 11.0 | 4.0 / 6.5 |

Who lost the battles (`seaStart`, the battles with one side all under way the hour before and the
other all standing): years 2–10, before, the side that sailed lost fewer ships in 104 and more in 38
(769 ships against the standers' 1,220); after, 122 and 46 (585 against 1,096).

- On this quick run, the first bar is met by emptying the far stations (1,332 → 12.9 fleet-weeks),
  not by fighting. The battles of years 2–10 pass 6.6 (7.3), but years 11–30 were not run (3.4
  before, `measure-a.md`). The world's navy is halved from year 2 (259k → 128k) and is still down
  at year 10 (139k against 177k). The fleets of nations at war with a navy fall by 96 % on seed 8693
  (`wars_*_8693`: 29,458 → 927 fleet-weeks), and its wars of two navies by 82 % (1,022 → 185
  war-weeks).
- The chasers mostly win. The war at sea becomes decisive: the navies meet in years 1 and 2, the
  weaker is sunk, and it is not built again at the pace it was sunk.

The AT's run, the critic's 14 seeds × 30 years (`b/full/`):

| | HEAD | the chase |
| --- | --- | --- |
| sea battles, year 1 (a world) | 35.7 | 55.0 |
| **sea battles, years 2–30 (a world-year; bar 6.6)** | **4.3** | **5.0** |
| a quarter of year 1 (7.39's bar) | 8.9 | 13.8 |
| late battles sinking nothing (bar 5 %) | 2.6 % | 1.2 % |
| **on station, the enemy fleet beyond reach, 2–30 (bar under 443)** | **886.4** | **14.5** |
| chasing, fleet-weeks a world-year, 2–30 | – | 8.6 |
| armed power (k) / fleets / navies, year 2 | 255 / 83 / 12.7 | 141 / 45 / 9.1 |
| year 5 | 226 / 78 / 16.3 | 118 / 41 / 12.9 |
| year 10 | 188 / 72 / 17.4 | 141 / 49 / 13.8 |
| year 20 | 212 / 73 / 18.0 | 188 / 59 / 14.6 |
| year 30 | 254 / 74 / 16.5 | 233 / 62 / 13.5 |

The first bar is met (886 → 14.5). The second is missed: 5.0 a world-year against 6.6. 7.39's own
bar, a quarter of year 1, moves away (8.9 → 13.8), since year 1 gains 19 battles. The world's
navy is 55 % of HEAD's at year 2, 52 % at year 5, 75 % at year 10. It is back to 89 % at year 20 and
92 % at year 30, in fewer fleets and navies.

**What the far station was doing.** Besides the blockade, it kept the navies afloat. Each navy stood
off the ports nearest it, and both lived until peace. The late battles of HEAD come from those
navies. A rule that brings them together in a war's first months, under ADR-270's "a battle it
would win", sinks one of them. The late bar then rests on the navies being rebuilt, which is not
`awayOrder`'s to do (PLAN 7.35d3 rebuilt the navies at HEAD's pace of loss).

## 4. The stop (ADR-554)

7.39b's AT is not met by the rule tried, on the AT's own run: the battles' bar is missed (5.0
against 6.6) while the far station is emptied. The cause found is not the station branch's. It
gets a BLOCKERS entry, and the cause, a navy sunk in a decisive war and not rebuilt, is PLAN 7.46
with its own AT. The chase waits on it (ADR-573, the user's decision). No sim change, the pin
unchanged.
