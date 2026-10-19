# PLAN 7.35a: the live sea battles with no ticker row (critic R9, naval 6), measured

2026-10-19. Tool: `tools/diag/seaRows.ts` (from 1938, `A` declares war on `D` at once as the
critic's script did; every hour, each live `SeaBattle`: whether two of its fleets at war stand
within reach of a ship's weapon, `inShipReach`, the snapshot's pair; the ships it sank that hour;
for the hours with no pair, its nearest pair at war, km, and what each fleet carries).
`npx tsx tools/diag/seaRows.ts 2251 ITA ENG 12`; `WHY=1` prints each hour that sank a ship with
no row.

## 1. Why a live battle has no row (code of `951b1c6`)

The critic's sampler (`critic/scripts/c9_n_seabattles.mjs`) counts a battle with `pair === null`
as row-less. A battle has a pair while two of its fleets at war are within a ship's weapon's
reach (PLAN 7.19b, ADR-494); a battle joined by a carrier's wings alone (they see and strike 250
to 313 km off, PLAN 5.4d) has none, and ADR-494 gave it no row.

Seed 2251, Italy on Britain, 12 days (Germany's and Japan's wars join it): 6 battles, every one
of Britain's.

| | battles | hours | hours with no pair | ships sunk | sunk in hours with no pair |
|---|---|---|---|---|---|
| all | 6 | 159 | 114 | 207 | 74 |

The two long ones are British carrier groups (2 carriers, 2 heavy cruisers, 6 destroyers; wings
seeing 250 to 313 km) against a German battle squadron and cruisers (48 hours, 10 with a pair,
39 ships sunk with none) and against the Italian fleet (92 hours, 18 with a pair, 35 sunk with
none), the nearest pair 217 to 279 km apart. The ships sunk with no pair are the carriers'
strikes (`navalCombatSystem`, once in `CARRIER_CYCLE` hours): no gun, torpedo or depth charge
reaches then, so nothing else of the battle can sink one. A strike wrote no event either: the
page drew the flight (`carrierStrikes`, a sortie) and nothing where it struck.

## 2. The rule (ADR-542, view only)

A battle with no pair whose carriers' wings (aboard) reach an enemy fleet with a ship on the
surface has a strike (`strikeTarget`: the nearest such carrier and fleet): the snapshot's `seas`
carries the struck fleet's place and the striker's nation (SEA_STRIDE 13 → 16). The ticker lists
it after the battles with a pair: "Carrier strike: United Kingdom on Germany's ships"; its click
flies to the struck fleet at the battle view's zoom (95 m/px). Each strike now emits, per fleet it
strikes, `StrikeHit` and `AirStrike` (events, not state): the bombs burst about the fleet at T0 to
T2 and on its ships as drawn at T3, as a land strike's (PLAN 5.9).

## 3. After

Seed 2251, the same 12 days, by the new rule (a row: a pair, else a strike):

| | hours with no row | ships sunk with no row at either end of their hour | ships sunk in an hour whose row ended in it |
|---|---|---|---|
| before | 114 | 74 | (not counted) |
| after | 11 | 0 | 30 |

- The 30: the hour began with a row and the fight it showed ended in it, the near fleet sunk
  whole (gone from the battle) or broken off; what is left of the battle is out of every reach
  (`WHY=1`: e.g. hour 69, a German cruiser squadron and destroyer flotilla 251 to 255 km from a
  carrier group; 12 ships sunk in the hour, while the row showed them).
- The 11 hours with no row: no weapon of the battle reaches (the carriers' wings away on sorties
  of their own, `carrierWings`; the fleets beyond their guns, closing). A row there would frame a
  fight that is not going on (R9-B1's bar: no battle shown where no weapon can reach).
- The page (`tests/e2e/carrierStrikeRow1938.spec.ts`): the first strike row of the game, hour 55,
  "Carrier strike: United Kingdom on Germany's ships", lands at 95 m/px on the German battle
  squadron at Heligoland with 16 of its ships on the screen; in the next 8 hours the strike's
  bombs are drawn (`a-strike-row-2251.png`, `a-strike-bombs-2251.png`).
