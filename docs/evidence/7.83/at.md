# PLAN 7.83's AT, read after 7.83b–d: missed

2026-10-23, HEAD `18895a39` (pin 5161de24). Logs in `at/`. Bundles of the headless CLI as in 7.83a
(`a/build.sh`): HEAD, `048d251c` (the commit before 7.83b's cuts, "pre") and `dd3b730`'s
(`.cache/prof83/base.mjs`).

## 1. The AT's figure: alone, 0xFFFF, no `--profile`, twice (`at/at_head1.log`, `at/at_head2.log`)

| run | year 1 | mean of 5 years | final hash |
|---|---|---|---|
| 1 | 2.5655 ms | 1.9702 ms | f278491d |
| 2 | 2.5346 ms | 1.9382 ms | f278491d |

Bar: mean ≤ 1.5 ms, missed by 0.44–0.47 ms; year 1 ≤ 2.4 ms, missed by 0.13–0.17 ms.

7.83a read the same command on the code before the cuts at 1.829 / 1.821 (year 1 2.294 / 2.258).
Today's reads are slower on code that does less. The pair below shows the cut is there, so the
difference is the machine. Year 1's miss is the machine too: HEAD's year 1 in the pair reads 2.36 /
2.39. One more oddity is recorded and left alone. Alone on all 16 CPUs reads slower (1.94–1.97) than
paired on four P-cores each (1.83–1.87). The AT's command is fixed, so it is the figure.

## 2. The cuts, paired: `048d251c` against HEAD, from 1938, both at once and swapped (`at/pre*.log`, `at/head*.log`)

| round | pre (cores) | HEAD (cores) | pre year 1 | HEAD year 1 |
|---|---|---|---|---|
| 1 | 2.1169 (0x000F) | 1.8712 (0x0F00) | 2.6996 | 2.3556 |
| 2 | 1.8689 (0x0F00) | 1.8277 (0x000F) | 2.3772 | 2.3937 |
| mean | 1.993 | 1.849 | 2.538 | 2.375 |

The mean falls by 0.144 ms (−7 %), with the same hash on every run (f278491d). That matches the sum
of 7.83b–d's own measured savings: invasion AI 0.078, supply 0.014, capitals 0.046, 0.138 in all.

## 3. What is left of the dearer rules: both rule sets on HEAD's year-4 world (`at/sh_*.log`, profiled)

HEAD's year-4 save of seed 99 was written again (7.83a did not keep it; hash c9bb34b2, as then). Then
a year was run by each bundle from it, as a swapped pair:

| | `dd3b730`'s rules | HEAD's rules | Δ |
|---|---|---|---|
| tick, mean of the pair | 1.821 (1.903, 1.740) | 1.966 (1.851, 2.080) | +0.145 |
| 7.83a, the same measure | 1.736 | 2.147 | +0.410 |

| system | `dd3b730`'s | HEAD's | Δ |
|---|---|---|---|
| operationalAi | 0.659 | 0.604 | −0.055 |
| invasionAi | 0.020 | 0.156 | +0.136 |
| supply | 0.146 | 0.197 | +0.051 |
| capitals | 0.027 | 0.027 | 0.000 |
| airAi | 0.197 | 0.203 | +0.006 |
| territory | 0.153 | 0.151 | −0.002 |
| combat | 0.111 | 0.128 | +0.017 |
| movement | 0.108 | 0.112 | +0.004 |
| war | 0.045 | 0.053 | +0.008 |

What the new rules add on one world is now about 0.15–0.2 ms, most of it the ferry's turn and the beach
layer (7.83b's and 7.83c's BLOCKERS entries: their rules' own work). On HEAD's world, `dd3b730`'s own
rules cost 1.82 ms a tick profiled. With none of the new rules, that world is already over 1.5.

## 4. Verdict

Missed: 1.97 / 1.94 ms against 1.5. Of the ~0.45 ms over the bar, the dearer rules hold at most 0.2. The
rest is the busier world: the land war that runs 1.5–2.7 × the cells flipped from year 2 (7.83a §2).
The biggest system there is the operational AI (0.60 ms, 31 % of the tick), and it costs the same under
either rule set. Halving it (0.3 ms) would not reach 1.5 either. The AT forbids changing an outcome to
save time.

What 1.5 ms buys: a headless year of 8,760 hourly ticks is 13.1 s at 1.5 ms and 17.0 s at 1.95 ms. The
page at Max showed 23–32 s for the late years in run 12 (21–24 s in run 11).

The bar's scope is the user's decision (ADR-654). No rule changed; the pin is unchanged (5161de24).
