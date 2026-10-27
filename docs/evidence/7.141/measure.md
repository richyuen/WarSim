# PLAN 7.141: the carriers built wait in port (critic run 16, naval 7)

The AT: on seeds 1233–1242 × 20 years against HEAD (`ee7355b7`) on the same seeds, hours with a carrier strike in
the air in years 2–20 at least 2 × HEAD's, transports at year 20 and ships sunk in years 2–20 not below 0.95 × HEAD's;
a unit test, red without; the gate green.

## 1. Why the carriers stand (`tools/diag/carrierWhy.ts`)

Daily at 01:00, every fleet with a carrier afloat of a nation at war: under way, in a sea battle, or what the naval
AI's `plan` does with it (`sortieWhy`); for those on station, why the nearest armed enemy fleet is not hunted
(`preyWhy`). From the critic's run-16 saves, 60 days each (`reads/`; the later year-20 seeds loaded part 1's economic
change, started mid-run, immaterial to a 60-day read of the naval AI's buckets).

| saves | carrier fleet-days at war | on station | of them: the enemy has no armed fleet anywhere | strike-hours |
|---|---|---|---|---|
| year 20, 12 saves (8 with carriers at war) | 960 | 568 | 445 (the rest: 120 beyond `SORTIE_KM`, 3 under way) | 2 |
| year 10, 12 saves (11 with carriers at war) | 2,405 | 1,880 | 1,880 | 11 |

8167 year 20: all three US carrier groups and every other US fleet (1,920 fleet-days) on station at Las Palmas for
120 days; the United States' enemies have no armed fleet. The carriers do what every warfleet does: a carrier strike
is flown only in a sea battle (`carrierStrikes`, SPEC 5.4d), and a sea battle needs an enemy ship. No bucket of a
battle declined (`tooStrong`, `strong`) appears in either read. 7019's group of the critic's follow is not in our
year-20 run (a carrier group in training at day 7300, delivered later); not chased.

Also found, not the cause here: a carrier counts nothing in `fleetPower` or `navalPower` (no gun, no torpedo), so a
carrier group weighs as its two cruisers and six destroyers in every fight-or-avoid test and in sea control.

## 2. The AT arm (`tools/diag/carrierAt.ts`, `at/`)

Part 1 (ADR-734, `441d3465`): a carrier group in training holds back no other warship. HEAD `ee7355b7` against it,
1233–1242 × 20 years, five at a time. Strike-hours: hours with a carrier strike in the air (`carrierStrikes`, the
critic's `c16_cvworld.ts` count).

| figure | HEAD | part 1 | ratio | bar |
|---|---|---|---|---|
| carrier strike-hours, years 2–20 (10 worlds) | 847 | 1,014 | 1.197 × | 2 × — **missed** |
| carrier strike-hours, year 1 | 1,512 | 1,512 | 1.000 × | — |
| ships sunk, years 2–20 | 13,754 | 14,182 | 1.031 × | 0.95 × — met |
| transports at year 20 | 4,930 | 4,710 | 0.955 × | 0.95 × — met |
| armed ships at year 20 | 3,036 | 3,296 | 1.086 × | — |
| carriers afloat at year 20 | 34 | 35 | 1.029 × | — |
| sea battles, years 2–20 | 1,524 | 1,521 | 0.998 × | — |

HEAD's strike-hours by year (each world): they come in bursts in the years a carrier's nation fights a navy (1233
year 5: 135; 1237 year 7: 113; 1234 year 2: 114), and are 0 in most world-years after year 8. Year 1 alone has 1.8 ×
the hours of years 2–20 together.

Part 1 moved transports down, not up (0.955 ×): the slot was not the cause of the critic's transport drop since
`7739a78` (−9 %); the gold the carriers and the warships now ordered beside them cost is the likelier one.

## 3. Reading

The late carrier is idle because its enemies have no ships, not because of an order the naval AI fails to give. No
rule of the carriers' sailing can double a figure bounded by the enemy navies afloat; the levers are what a carrier's
wings may strike (a design change: today only ships in a sea battle) or more navies late (7.142's and the economy's
ground). ADR-735 to the user.
