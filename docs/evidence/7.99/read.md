# PLAN 7.99: the read first (2026-10-23)

HEAD `08d874a5`. `tools/diag/airIdle.ts` on seeds 871 and 872 × 20 years (`idle_*.json`, `idle_*.out`):
every 7th day, in the hour `airAi` gave its missions, the land-based wings of living AI nations at war,
by role and mission; those of a fighter's or striker's role with none, by what of the enemy lies within
their range of their base.

| seed, years | missions a day | idle a day | idle fighters and strikers | enemy airbase in range | of it manned | enemy fleet | nothing | nearest enemy land > 4 ranges |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 871, year 1 | 46.5 | 30.0 | 24.4 | 30 % | 8 % | 13 % | 70 % | 14 % |
| 871, 2–20 | 11.3 | 42.5 | 35.2 | 8 % | 2 % | 3 % | 90 % | 65 % |
| 872, year 1 | 29.2 | 78.6 | 69.5 | 17 % | 3 % | 1 % | 83 % | 30 % |
| 872, 2–20 | 13.0 | 65.2 | 57.2 | 13 % | 7 % | 7 % | 82 % | 61 % |

**Read:** after year 1, of 35–57 idle fighters and strikers at war a day, 82–90 % have nothing of the
enemy in range: no land formation, airbase or fleet. An enemy airbase is in range of 8–13 % (a manned one
2–7 %), a fleet 3–7 %. The nearest enemy land formation is over four ranges off for 61–65 %: the wings at
war stand far from their enemies, and PLAN 7.99's rule can reach at most a tenth to a fifth of them.

## A/B on the same seeds (`ab/`, `airLate.ts` × 20 years, HEAD in a worktree, the rule in the tree)

| seed | year 1 | late a year | share | aloft late | engaged per war late | wars late |
| --- | --- | --- | --- | --- | --- | --- |
| 871 HEAD | 3,848 | 127.6 | 0.033 | 11.25 | 0.469 | 10.23 |
| 871 rule | 3,855 | 188.9 | 0.049 | 15.84 | 0.401 | 9.28 |
| 872 HEAD | 1,118 | 237.9 | 0.213 | 12.90 | 0.480 | 7.27 |
| 872 rule | 1,121 | 218.8 | 0.195 | 19.90 | 0.508 | 5.16 |
| pooled HEAD | 4,966 | | **0.074** | | | |
| pooled rule | 4,976 | | **0.082** | | | |

Sorties aloft late +40–55 % on both seeds; air battles +11 % pooled (per war-year 12.5 → 20.4 on 871,
32.7 → 42.4 on 872: the histories drift, 872's wars 7.3 → 5.2). Most of the new sorties meet nothing,
which ADR-520 warned of. The next section reads whether they do.

## Do they meet anything? (`tools/diag/airSweeps.ts`, the rule in the tree, `sweeps_*.json`)

Seeds 871 and 872 × 10 years, hourly. A sortie is PLAN 7.99's when its wing is a fighter or striker and
its target an airbase held by an enemy, or (not a naval bomber) an enemy's fleet. It "fought" where it was
within `INTERCEPT_KM` (150 km) of an `AirBattle` in its hour (an upper bound).

| seed, years 2–10 | air battles | of them with a 7.99 sortie near | 7.99 sorties | of them that fought |
| --- | --- | --- | --- | --- |
| 871 | 2,330 | 194 (8 %) | 41,263 | 495 (1.2 %) |
| 872 | 2,492 | 288 (12 %) | 79,209 | 738 (0.9 %) |

On 872 in years 8–10, 33,833 such sorties and 21 air battles in all, none near one. **About 99 % of the
sorties the rule adds meet nothing:** the bar met by flying for it, which ADR-520 rules out. A sweep over
a manned enemy airbase fights only where that base's wings chose to fly on their own; nothing on the
ground takes off against it, and `strikes` does not touch wings on the ground.

**Verdict:** no rule committed (`rule.patch`: the rule and its unit test, red without, green with). What
is missing is a defence that rises to meet a raid: a wing at an airbase takes off against an enemy
sortie coming within reach of it. That flies only when there is something to meet. ADR-672.
