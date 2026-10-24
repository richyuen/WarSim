# PLAN 7.101: a defence that rises, the read first (2026-10-23)

HEAD `2640964c` (the pin 7c2e4700), seeds 871 and 872, the tree with `rule.patch`:
- **the scramble** (`systems/air.ts`, `scramble`): each hour, against each raid (a sortie of a wing
  with a mission, out or over its target), the idle fighter wing nearest it of a nation at war with the
  raider's (an AI nation's, at an airbase, no mission, no sortie) whose range reaches the raid takes off
  over the raid's target (over its place where the target is out of range), one a raid; a scramble has
  no mission and is no raid itself; unit test `airScramble1938.test.ts`, red without, green with;
- **7.99's sweep, narrowed** (`ai/air.ts`): a fighter with no enemy land forces in range sweeps an enemy
  airbase with an enemy wing on it, else a fleet; a striker a fleet, else such a base; never an empty
  base (7.99's third choice dropped); `airEnemyAir1938.test.ts` to match.

## 1. How many sweeps it turns into fights (`airSweeps.ts`, years 2–10; `sweeps_*.json`)

| seed, years 2–10 | air battles | with a sweep near | sweep sorties | of them that fought | over a base | that fought |
|---|---|---|---|---|---|---|
| 871, 7.99's rule | 2,330 | 194 | 41,263 | 495 (1.2 %) | 34,813 | 474 (1.4 %) |
| 871, 7.101's | 1,930 | 142 | 12,051 | 188 (1.6 %) | 2,646 | 154 (5.8 %) |
| 872, 7.99's rule | 2,492 | 288 | 79,209 | 738 (0.9 %) | 49,794 | 706 (1.4 %) |
| 872, 7.101's | 3,846 | 426 | 39,935 | 713 (1.8 %) | 11,884 | 302 (2.5 %) |

The sweeps fall to a third and a half (no empty bases); of those left, **1.6–1.8 % fought** (the AT's bar:
half).

## 2. Why a sweep over a manned base meets no defender (`airScrambleWhy.ts`, new; years 2–5; `why_*.json`)

Each hour a fighter's sweep is over its airbase: the enemy's wings based there.

| | 871 | 872 |
|---|---|---|
| sweep-hours over the base | 559 | 2,173 |
| of them with a battle within INTERCEPT_KM | 44 (7.9 %) | **0** |
| no enemy wing on the base any more (it left since the day's order) | 54 (10 %) | **1,656 (76 %)** |
| enemy wings on it, none a fighter | **218 (39 %)** | 413 (19 %) |
| the base's enemy fighters, wing-hours: aloft on their own missions | 345 | 100 |
| — scrambled | 29 | 71 |
| — idle on the ground | 11 | 9 |

The sweep's target is picked at the day's start as a base with an enemy wing on it. By the hour it
is over it, the base is empty (the wings rebased or were lost), or holds bombers only, or its fighters
are out on their own missions. An idle fighter on the swept base is rare: the scramble has almost
nothing there to raise.

## 3. The late air war on the two seeds (`airLate.ts` × 20 years)

| variant | late a year ÷ year 1, pooled (bar 0.1) | 871 | 872 | engaged per war late, 871 / 872 |
|---|---|---|---|---|
| HEAD (`7.99/ab/head_*`) | 0.074 | 0.033 | 0.213 | 0.469 / 0.480 |
| 7.99's sweep (`7.99/ab/rule_*`) | 0.082 | 0.049 | 0.195 | 0.401 / 0.508 |
| the scramble alone (`scr_*`) | 0.074 | 0.032 | 0.136 | 0.550 / 0.635 |
| the scramble and the narrowed sweep (`late_*`) | **0.098** | 0.048 | 0.179 | 0.654 / 0.710 |

Two seeds, and each variant changes year 1 too (871: 3,848 / 3,855 / 2,836 / 2,836 battles), so the
histories part from the first year.

**Verdict:** the AT's second clause (half the sweep sorties meeting a defender) is out of this rule's
reach by §1–2 (1.6–1.8 %); the full AT not run. The first clause comes near on the two seeds (0.098)
with the two rules together; the scramble alone moves nothing. No rule committed (`rule.patch`).
ADR-674.
