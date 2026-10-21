# PLAN 7.59: two placed navies out of sight never meet (ADR-608)

## The case

Found at 7.41c (`docs/evidence/7.41/c.md`): the critic's scenario
(`critic/c11_critic_standoff.warsim-scenario`) has two German battle squadrons, 1468 and 1469, and
two British, 1470 and 1471, placed by the editor in the North Sea. Germany declares war on Poland
and then on Britain at tick 0. A placed fleet held its place (PLAN 7.22c) and saw about 29 km, and
the stations are 107–120 km apart. Germany's pair met Britain's home fleet, which sortied from port.
Britain's placed pair fought nothing in 30 days.

## Measured first (`tools/diag/editorFleets.ts`, its `daily` rows, HEAD `83a6310`)

For each living placed fleet at 00:00 each day: its nearest standing enemy warfleet
(`standingWarfleets`), that fleet's zone against the zone of the place, and `awayOrder`'s battle
test (the enemy's power in the target's zone no more than its nation's standing warfleets within
SORTIE_KM together).

| day | fleet | AI day | nearest standing enemy warfleet | its zone / the place's | enemy | together (placed alone) | takes |
|---|---|---|---|---|---|---|---|
| 1 | 1470 ENG | yes | Germany's 1469, 107 km | 263 / 263 | 22,800 | 99,700 (22,800) | yes |
| 1 | 1471 ENG | yes | Germany's 1468, 114 km | 263 / 263 | 22,800 | 99,700 (22,800) | yes |
| 2–8 | 1470, 1471 | day 8 | a German fleet, 428–440 km | 294 / 263 | 10,400–16,200 | 42,150–89,900 | yes |
| 9–12 | 1470, 1471 | – | an Italian fleet, 1,972–1,987 km | 164 / 263 | 450 | 77,500–80,050 | yes |
| 15, 22, 29 | 1470, 1471 | yes | Italian fleets, 5,022–6,383 km | 275, 276, 88 / 263 | 300–1,200 | 2,650–38,300 | yes |

On Britain's first AI day, Germany's placed pair stands 107–114 km off in the place's own zone, and
the test takes it. Every later nearest enemy is in another zone. From day 9 they are Italian, in the
Mediterranean and beyond, and the battle test takes those too. So the reach is the place's zone, not
a distance: within SORTIE_KM (2,500 km) the North Sea's placed squadrons would sail for Italy's.

## The rule (`src/sim/ai/naval.ts`, ADR-608)

At war, on its AI day, a fleet the editor placed sails for the nearest standing enemy warfleet in
the zone of its place whose zone's enemy power is no more than its nation's warfleets there together
(the placed fleets of that zone counted in). It stays by one it is already by. With none, it sails
back to its place when it is more than AT_PORT_CELLS off it. At peace it holds its place, as before.

## Read: the critic's scenario, 30 days

| | HEAD `83a6310` | the rule |
|---|---|---|
| Britain's 1470, 1471 in a sea battle | 0, 0 | 1, 1 (from hour 27, off Den Helder, beside Britain's home fleet against Germany's 1468) |
| Germany's 1468, 1469 in a sea battle | 2, 2 | 3, 3 |
| Germany's pair sunk | hours 98, 95 (French fleets off Wilhelmshaven) | hours 101, 102 (the same) |
| Britain's pair at day 30 | living, 11,400 each, on station | living, 7,900 and 8,400, on station (back from day 9, after the AI day of day 8) |
| sea battles between the two blocs | 30 | 28 |

Both pairs of placed fleets are in a sea battle within 30 days: the AT holds. Afterwards Britain's
pair holds its sea: from day 9 it stands on its place (0 cells off) while the nearest enemy is Italian.

## Tests

`tests/unit/fleetStation1938.test.ts` (seed 5591, the critic's four places about its North Sea
point; 7.22c's test) is restated. Its old case, "Britain's pair: no battle came to it, and it never
left", is what this task changes. Now, every hour of 10 days of war, a fleet with its place keeps
the place until it breaks off, and is on it, in a battle, under way, or standing in its place's
zone; both British placed fleets are in a sea battle within the 10 days (red without the rule: 0 of
2). New: at peace, over 10 days (every AI day among them), each of the four stays within
AT_PORT_CELLS of its place.

Pin: seed 99 has no placed fleet, so the rule does not act there.
