# PLAN 7.146: what holds the land army of long-front wars down late (2026-10-27)

HEAD `49bf9d01` (rules of `60e008c6`: ADR-736's wing rebuild, ADR-737's k-th strike at 1 / (1 + k) and ADR-738's
carrier strikes ashore are in it; ADR-737 and ADR-738 wait on the user). Saves: seeds 1294, 1297, 1300, 1303 (spent by
PLAN 7.144) from 1938 to years 10 and 20 on HEAD (`.cache/7146/head/`, not committed). New tools:
`tools/diag/longWarArmy.ts`, `frontedRoles.ts`, `longWarGates.ts`, `dryArmy.ts`. The population throughout: the members of
wars with a land front of 100 cells or more, each side weak or strong by its men on land (a nation in several such wars
takes its longest front's role).

## 0. The AT's floors on HEAD

`docs/evidence/7.140/design.md` (HEAD of 2026-10-27 on 1253–1263 but 1259, 30 years): land changing hands at least 2 % of
the land cells each year in 19 of 20 worlds (1263: 1.56 %), front battles every year in all. The floor is met by HEAD in
most worlds, not all: a world of the AT's ten may miss it on either arm.

## 1. Who loses what (`longWarArmy.ts`, 180 days from each save; `longWar_y10.json`, `longWar_y20.json`)

A day, four saves pooled:

| | nations | land formations | men | engaged | wars | front a war (cells) |
|---|---|---|---|---|---|---|
| year 10, weak | 18.8 | 59.7 | 408,000 | 1.91 | 4.49 | 805 |
| year 10, strong | 30.3 | 311.5 | 2,446,000 | 2.89 | | |
| year 20, weak | 23.0 | 50.0 | 280,000 | 1.00 | 5.61 | 1,836 |
| year 20, strong | 39.7 | 386.7 | 3,159,000 | 1.65 | | |

Men lost (engaged + not engaged) and gained in the 180 days, four saves:

| | combat | air | supply | nuclear | the fold (economic AI) | capitals | raised (production) | refilled |
|---|---|---|---|---|---|---|---|---|
| y10 weak | 612,200 + 31,732 | 39,134 + 100,165 | 20,991 + 108,111 | 4,236 | 25,218 (72 gone) | 36,262 | 47 formations, 367,920 | 21,051 |
| y10 strong | 241,165 + 6,974 | 41,243 + 108,849 | 23,357 + 425,777 | 17,138 | 21,347 (48 gone) | 0 | 98, 896,220 | 132,042 |
| y20 weak | 239,617 + 9,207 | 57,977 + 112,522 | 9,308 + 101,016 | 23,233 | 19,176 (44 gone) | 10,857 | 36, 243,300 | 16,570 |
| y20 strong | 189,895 + 5,147 | 38,964 + 148,890 | 4,750 + 272,495 | 124,634 | 42,145 (63 gone) | 0 | 112, 966,210 | 202,259 |

- The weak side loses 2.2–2.5 × what it raises and refills; its army is a sixth to an eleventh of the strong side's.
  Its largest loss is combat in contact (the war is fought where it has men), then the air on formations out of
  contact (100,000–113,000), then supply.
- The strong side's largest loss is supply attrition of formations out of contact (272,000–426,000), more than combat.

## 2. Where the dry formations stand (`dryArmy.ts`, 30 days from each save; `dry_y10.json`, `dry_y20.json`)

A day, at hour 12, land formations at supply 0: strong side 2.3 (year 10) and 4.8 (year 20) of 298–354, two thirds far
(over 60 cells) from their war's front, most on a neutral's cells, on the march (the ferry's and the far march's army);
weak side 1.4 and 0.5 of 43–44. Their men at hour 12 × 2 % a day reads ~80,000 of the strong side's 272,000 at year 20;
the rest is terrain attrition (`supplyAttrition`) and formations dry for part of a day. Not a lever on contact: saving
them adds men far from any front.

## 3. The weak side's money (`armyGatesNow.ts` × `frontedRoles.ts`, 6 month starts from each save; `gates_y*.json`,
`fronted_y*.json`; `longWarGates.ts`)

`fronted`: holding front cells of the war, or a land formation on a landmass with one. Of the weak side 82 of 107 nations
(year 10) and 102 of 125 (year 20) are fronted. Per role, nation-months; income in gold a month:

| | nation-months | income a month (mean) | orders | army upkeep | CE cost | suppression | refills | first gates |
|---|---|---|---|---|---|---|---|---|
| y10 weak fronted | 333 | 178 | 25 | 0.066 | 0.193 | 0.053 | 0.018 | gold 148, balance 66, slots 49, ship 29, share 22, other 19 |
| y20 weak fronted | 389 | 88 | 21 | 0.069 | 0.175 | 0.059 | 0.029 | gold 169, balance 110, slots 57, ship 22, share 14, other 17 |
| y20 strong fronted | 528 | 600 | 98 | 0.120 | 0.218 | 0.097 | 0.066 | gold 251, balance 94, slots 77, other 73, share 24, ship 9 |

By income band, the weak fronted side at year 20 (year 10 in brackets):

| band | months | share of the side's income | orders | gates | the gate after a full slot |
|---|---|---|---|---|---|
| 0–20 | 161 (108) | 0.029 (0.013) | 1 (2) | balance 97, gold 47, share 14 | |
| 20–100 | 124 (98) | 0.165 (0.082) | 3 (4) | gold 98, slots 14 | gold 12 |
| 100–400 | 88 (89) | 0.579 (0.280) | 10 (11) | slots 35, gold 22, ship 19 (8) | gold 20, ship 13 (4) |
| 400–1000 | 16 (29) | 0.228 (0.302) | 7 (8) | other 6, slots 5, ship 3 (14) | |
| 1000+ | 0 (9) | 0 (0.323) | 0 (0) | (ship 7, slots 2) | |

- Three quarters of the weak fronted nation-months are under 100 a month: remnants that no order rule reaches (a
  cadre division is 504 gold, 5–25 months of their income).
- The side's money is in the 100–1000 band (0.81 of its income at year 20, 0.58 at year 10, with 0.32 at 1000+). There
  the warship's saving (ADR-557, ADR-575: at war with an enemy that has an armed fleet, an army of more than
  FEW_FORMATIONS saves the cheapest warship's price) holds the army's orders and refills in 37 of 104 months at year 20
  (22 first, 15 behind a full slot) and 42 of 127 at year 10 (29 + 13 with the 1000+ band). The one slot (1 + income /
  PARALLEL_INCOME) holds another 40; behind it gold in most.
- The strong side's rich (1000+, 0.80–0.85 of its income) order nearly every month; its gates are armour's saving and the
  slots.

## 4. What this says for a rule

The contact of a long-front war is held by the weak side's presence: some 50 formations of 23 nations on fronts of
~1,800 cells late, ground down 2.2–2.5 × faster than it rebuilds. Of its gates the one a rule can open without new gold
is the warship's saving: a nation fighting on land, outnumbered, saves for a destroyer while its front thins. Britain's
case for the saving (ADR-575) was a nation with no land front; a nation that holds a land front where its side has
fewer men on land than the other is not that case.
