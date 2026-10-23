# PLAN 7.83a: the tick on HEAD against `dd3b730`, measured (read only)

2026-10-23, HEAD `e0c5433e` (pin 5161de24) against `dd3b730` (critic run 11's commit, the base of
run 12's performance finding). Bundles of each commit's headless CLI (`a/build.sh`; `dd3b730`'s
`src/`, `tools/`, `data/` from `git archive`). Pairs: both bundles at once on separate P-cores
(0x000F, 0x0F00), then swapped (`a/pair.sh`); tabulated by `a/agg.mjs`. Profiled figures read
higher than the unprofiled ones (the clock calls), so only the unprofiled run is the AT's figure.

## 1. The AT's figure on HEAD, alone on 0xFFFF, no `--profile` (`a/at_head1.log`, `a/at_head2.log`)

| run | year 1 | mean of 5 years | final hash |
|---|---|---|---|
| 1 | 2.2944 ms | 1.8289 ms | f278491d |
| 2 | 2.2584 ms | 1.8205 ms | f278491d |

Bar: mean ≤ 1.5 ms (missed by 0.32–0.33 ms, 18 %), year 1 ≤ 2.4 ms (met).

## 2. From 1938, seed 99 × 5 years, profiled pairs (`a/from1938.txt`, `a/p_*.log`)

Tick mean 1.334 (`dd3b730`) → 1.986 ms (HEAD), +0.653. By year (mean of the two rounds):

| year | tick | p95 | formations | cells flipped |
|---|---|---|---|---|
| 1 | 2.115 → 2.493 | 6.35 → 8.49 | 917 → 919 | 31,657 → 32,274 |
| 2 | 1.294 → 1.885 | 5.18 → 7.88 | 727 → 743 | 30,410 → 50,800 |
| 3 | 1.180 → 1.717 | 4.82 → 6.74 | 635 → 597 | 49,149 → 47,538 |
| 4 | 1.164 → 2.117 | 4.35 → 11.22 | 582 → 598 | 32,448 → 56,003 |
| 5 | 0.914 → 1.719 | 3.54 → 8.35 | 610 → 594 | 19,531 → 52,208 |

The systems that grew (mean ms a tick over the 5 years; longest call; calls of 1 ms or more a year):

| system | `dd3b730` | HEAD | Δ | longest | slow calls |
|---|---|---|---|---|---|
| operationalAi | 0.276 | 0.473 | +0.197 | 43 → 46 | 968 → 1,235 |
| invasionAi | 0.010 | 0.154 | +0.144 | 10 → 41 | 11 → 294 |
| supply | 0.113 | 0.179 | +0.067 | 30 → 45 | 144 → 640 |
| combat | 0.126 | 0.188 | +0.062 | 64 → 26 | 57 → 167 |
| territory | 0.105 | 0.163 | +0.058 | 4 → 15 | 6 → 55 |
| movement | 0.149 | 0.180 | +0.031 | 16 → 16 | 75 → 93 |
| airAi | 0.135 | 0.162 | +0.027 | 36 → 34 | 355 → 351 |
| capitals | 0.025 | 0.051 | +0.026 | 87 → 36 | 3 → 27 |
| war | 0.032 | 0.053 | +0.021 | 31 → 65 | 15 → 21 |

The world is the same size in formations, but HEAD's flips 1.5–2.7 × the cells from year 2.

## 3. More work or dearer work: both rule sets from one saved world

Each commit's own year-4 save (`s_base_y4.bin`, `s_head_y4.bin`, in `.cache/prof83/`, not kept), then a
year by each bundle from it, profiled pairs (`a/baseWorld.txt`, `a/headWorld.txt`, `a/sb_*.log`,
`a/sh_*.log`):

| world (year 5) | `dd3b730`'s rules | HEAD's rules | Δ |
|---|---|---|---|
| `dd3b730`'s save | 1.116 | 1.516 | +0.400 |
| HEAD's save | 1.736 | 2.147 | +0.410 |

Same rules on the two worlds: `dd3b730`'s 1.116 → 1.736 (+0.62), HEAD's 1.516 → 2.147 (+0.63). About
0.6 ms is the busier world; about 0.4 ms is HEAD's rules on the same world. By system:

| system | on `dd3b730`'s world | on HEAD's world | read |
|---|---|---|---|
| invasionAi | 0.009 → 0.118 (+0.109), slow 5 → 327 | 0.017 → 0.236 (+0.219), slow 20 → 339 | dearer: the ferry's turn (ADR-612 → 652) |
| supply | 0.105 → 0.180 (+0.076), slow 153 → 639 | 0.138 → 0.217 (+0.079), slow 267 → 665 | dearer: the beach layer (7.70a, 7.75; ADR-622, 630) |
| capitals | 0.022 → 0.033 (+0.011) | 0.027 → 0.075 (+0.048), slow 2 → 30 | dearer: the capital moves (ADR-620, 640, 641) |
| airAi | 0.162 → 0.204 (+0.042) | 0.197 → 0.219 (+0.021) | small, partly the world's year |
| war | 0.029 → 0.050 (+0.022) | 0.043 → 0.058 (+0.015) | small |
| operationalAi | 0.244 → 0.319 (+0.075) | 0.620 → 0.606 (−0.015) | more work: the same cost on the same world |
| territory | 0.068 → 0.088 (+0.020) | 0.151 → 0.152 (+0.002) | more work |
| combat, movement | +0.016, +0.021 | +0.023, +0.012 | mostly more work |

## 4. What it names

The AT asks 0.33 ms off the mean. The dearer rules on one world come to 0.40–0.41 ms, of which the
invasion AI 0.11–0.22 (its turn is over 1 ms on 294–339 days a year), supply 0.08 and capitals
0.01–0.05. The operational AI, territory and combat grew with the war the new rules make (more cells
flipped), not by dearer calls: a cut there is an optimisation of the system as it was, not of a new
rule. Parts (each the same outcome, pin unchanged): 7.83b the invasion AI's ferry turn, 7.83c supply's
beach layer, 7.83d the capitals system; then 7.83's AT read, and if it still misses, the busier world's
systems (operational AI first) or the bar's scope (the user's).

For 7.83b–d: `a/build.sh` builds `dd3b730` as the base. A part's AT compares HEAD before its change
with HEAD after it, so its base bundle is the commit before the part, and the year-4 save is written
again from that commit (`--years 4 --save`; the year-4 hash c9bb34b2 on `e0c5433e`). The invasion AI's
slow calls (327–339 a year, about one a day) say the ferry's turn itself runs over 1 ms; its route
searches (FERRY_SEARCHES 68 a turn) are the first place to look under `node --cpu-prof`.
