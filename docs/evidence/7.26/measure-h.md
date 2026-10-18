# PLAN 7.26h: where the great powers' own transports are on their `noTransport` days

2026-10-18, on `d722512` (no rule changed). Tool: `tools/diag/transports.ts` (seeds 2843 and 7919
× 8 years, side by side, 2.5 minutes each; files `.cache/726h/t_<seed>.json`).

For Germany, Britain, the Netherlands, the US and Japan, each day the nation is in a war in which it
has no land front, has no formation aboard, and has no transport group of its own standing at the
water of a port it holds with room (`landWar.ts`'s `noTransport`): the state of each of its
transport groups (template `transport_group`), the first that holds of `aboard`, under way (to an
own, bloc, enemy or other port's water), in a sea battle, no room left, at an own port's land cell
but not its water, at a bloc port, at a lost base, standing away with an own port reachable
(`awayHome`) or with none (`awayNoHome`). On days with no group: whether a land front in another
war bars a new one (`economic.ts`'s `pickFleet`), and the treasury.

## Totals (8 years)

| seed | nation | `noTransport` days | of them with no group | no group, front elsewhere | group-days by state | groups seen / gone |
|---|---|---|---|---|---|---|
| 2843 | GER | 2,099 | 1,719 | 746 | awayHome 380 | 5 / 5 |
| 2843 | ENG | 1,005 | 1,005 | 564 | — | 7 / 6 (the 4 of 1938 all sunk in year 1) |
| 2843 | NED | 2,406 | 2,406 | 237 | — | 0 / 0 |
| 2843 | USA | 0 | — | — | — | 4 / 0 |
| 2843 | JAP | 3 | 0 | — | awayHome 10, toOwn 1, atLost 1 | 4 / 1 |
| 7919 | GER | 980 | 387 | 9 | awayHome 593 | 2 / 1 |
| 7919 | ENG | 1,314 | 0 | — | awayHome 5,240, toOwn 16 | 4 / 0 |
| 7919 | NED | 2,398 | 2,398 | 100 | — | 0 / 0 |
| 7919 | USA | 0 | — | — | — | 4 / 0 |
| 7919 | JAP | 1 | 0 | — | awayHome 4 | 4 / 0 |

`aboard`, `inBattle`, `noRoom`, `atOwnLand`, `atBloc`, `atLost` (but one day), `awayNoHome`: none
or near none. The bloc-port mismatch between the naval AI (bloc's ports) and the invasion gate
(the nation's) does not show here. The US and Japan almost never meet the gate.

## Two causes

**1. A group that has landed its men is left where it landed, for years.** At war the naval AI
moves only fleets with power (`fleetPower` > 0) and submarines (`naval.ts` `plan`); a transport
group has neither, and `amphibiousSystem` sends it home only when the landing is thrown back. So
after a landing it stands at the landing's water until the war ends (`sailHome` at peace) or it is
sunk, with an own port reachable on every such day (`awayHome`, never `awayNoHome`):
- seed 7919: Britain's four 1938 groups stand at cell 1006,333 from year 1 to year 6 (days stood at
  year's end: median 122, 394, 624, 1,244, 1,489, 1,763): 1,314 of its `noTransport` days, all of
  them; 16 group-days under way home in year 6;
- seed 7919: Germany's one group at 1595,520 for up to 665 days (years 6–8), 593 days;
- seed 2843: Germany's at 1006,239 for up to 542 days (years 4–5); Japan's for up to 586 days.
While such a group lives, `pickFleet` builds no other (`own.some(transport)`), so the nation has
neither its group nor a new one.

**2. No group at all, and none built.** 93 % of seed 2843's days and 59 % of 7919's. The
Netherlands never has a transport group (none in 1938, none built in 8 years on either seed, gold
1,800 → 3,900 and growing). Germany and Britain build one or two a year on 2843 and lose them
(5 of 5 and 6 of 7 gone). Of the days with none, a land front in another war bars a build
(`hasFront` is any war's, the landing's gate per war since ADR-511) on 31 % (2843) and 4 % (7919).
The rest have no front anywhere and a full treasury (Germany 14,000–19,000 gold) and still order
none: the fleet slot's other conditions (`economic.ts:423`: no ship in the yards, the navy's upkeep
under `NAVY_SHARE` 0.12 of income, `mix.fleets`) were not measured here.

## Free formations

On the `noTransport` days the nation's free land formations stand on a land with a port of its own
(seed 7919 Britain: median 4–7 formations, 34,000–87,000 men; Germany up to 39 and 431,000 men in
year 7); on a land without one: 0 every year but one. The men are there for a landing; the
transports are not.

## Split

- 7.26h1: a transport group with no men aboard, standing away from its bloc's ports at war, sails
  home (cause 1).
- 7.26h2: which of the fleet slot's conditions stops the build on the no-group days, measured
  first, then the rule (cause 2).
