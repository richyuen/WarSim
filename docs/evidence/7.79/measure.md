# PLAN 7.79a: where the army of a nation at war goes late (measured, no rule)

2026-10-22, on HEAD `9490fd78` (the sim code of the critic's run 12, `896ff779`), run 12's saves
(`critic/c12_seed*_y10.bin`, `_y20.bin`) and year 1 of seeds 6421 and 7019 from 1938 (days 61–90).
Tools: `tools/diag/frontSpread.ts`, `piles.ts`, `pileOrders.ts`, reading `OP_PROBE.sectors` (new,
`src/sim/ai/operational.ts`: read only, in no save and no hash; the pin unchanged).

## 1. Why this, not 7.49a again

Engaged land formations per war = (armed wars per war) × (engaged per armed war). 7.49a's figures:
year 1 about 0.48 × 20, late about 0.11 × 0.4. Year 1's armed share with the late second factor
gives about 0.2 a war; the late armed share with year 1's second factor about 2.2. 7.49's parts
moved armies to the landmass (the first factor) and left engaged per war flat. The second factor,
where the armies near a front stand against the enemy's, is this measure's.

## 2. The allotment (`frontSpread.ts`, daily, every plan of a nation at war)

| save | sectors a plan | threatened a plan | formations a plan | share in threatened sectors | allotted to threatened, before / after "every sector gets one" | engaged a war |
|---|---|---|---|---|---|---|
| 6421 year 1 (days 61–90) | 144 | 31.2 | 11.8 | **0.741** | 0.795 / 0.741 | 14.6 |
| 7019 year 1 (days 61–90) | 138 | 25.3 | 11.0 | **0.578** | 0.741 / 0.550 | 10.5 |
| 6421 year 10 | 269 | 14.3 | 8.1 | 0.079 | 0.170 / 0.170 | 0 |
| 6421 year 20 | 916 | 26.9 | 6.7 | 0.145 | 0.340 / 0.340 | 0.04 |
| 7019 year 10 | 185 | 9.5 | 5.1 | 0.069 | 0.184 / 0.184 | 0.10 |
| 7019 year 20 | 123 | 6.3 | 7.3 | 0.232 | 0.287 / 0.269 | 0 |
| 1129 year 10 | 128 | 2.7 | 7.1 | 0.039 | 0.052 / 0.052 | 0.06 |
| 1129 year 20 | 269 | 6.7 | 3.9 | 0.006 | 0.006 / 0.006 | 0.18 |
| 2081 year 20 | 840 | 26.2 | 2.2 | 0.053 | 0.237 / 0.237 | 0.10 |

(5309 year 20: no war in the 10 days.) A sector is threatened when enemy formations stand in its
3 × 3 sector neighbourhood (12 × 12 cells). `spread_y1.json`, `spread_late_a.json`, `spread_late_b.json`.

- In year 1 three in five to three in four of the formations a plan allots stand in a threatened
  sector; late one in twenty to one in five. The armies near the front are not where the enemy is.
- "Every sector gets one" (which takes from the largest allotments to give each sector one) is not
  it: late the share before and after it is the same, in year 1 it costs 0.05–0.19.
- The cause is the weights: a sector weighs 1 + threat / THREAT_UNIT (10,000 men). Late the fronts
  are 120–920 sectors long with 3–27 threatened, and the enemy's formations are small, so a
  threatened sector weighs about 1–3 against the 100–900 of the empty front: the allotment spreads
  the army over the empty front by its length. In year 1 the threats are 100,000s of men (weights
  of 10–50) and win.
- Threatened sectors attacking: 0.02 in year 1, 0–0.09 late. Not a late cause.

**Cause 1 (PLAN 7.79b):** with a long front and small threats the allotment puts the army by front
length, not by where the enemy stands.

## 3. The pile of 60 US divisions (1129 year 10; `piles.ts`, `pileOrders.ts`)

On 30 days from the save, nations at war with 30 or more land formations on one cell 30 days running:
1129 year 10 two (the USA, 60 at cell 625163 and 53 at 746057, 148–198 cells from its nearest own front
cell, at war with Britain), 6421 year 20 one (the USA, 77, 234 cells), 7019 year 10 none. None moves or
fights in the 30 days (`piles.json`).

Every plan of the USA (`pile_1129_usa.json`): 169 formations, 12 near a sector, 15–23 far a day, 24–25
of its 34–40 sectors with nobody, and no ask of the marches from afar in 30 days. The pile's class
reaches none of the sectors: 35 of 38 are on another landmass and no cell of the pile's snaps to them
(the war with Britain is overseas); 2 are in another province group (closed ground between) and 1 in
another pocket. Its continent has a front cell of the USA, so the ferry (7.49d1, ADR-612: a landmass
with no front of the nation) does not take it, and nothing else does.

**Cause 2 (PLAN 7.79c):** a nation's formations on a landmass whose front cells their class reaches
none of are neither allotted nor ferried.

## 4. What is left for the user

Neither cause is the first factor (wars declared on the weak, 7.49a §3, §6). If 7.79b and 7.79c leave
engaged per war under the bar, that factor is the user's (ADR-554).
