# PLAN 7.90h: the sail past remnants cut off from their ports (2026-10-23)

On HEAD `9ae9ec70` (pin 5161de24), critic run 12's seed 6421 year 20 save, the USA.

## The read

New probe `tools/diag/sailCut.ts` (`FERRY_PROBE`, with a probe-only `FerryTry.tried`: the formations
whose ports a sail asked). On each ferry turn of the nation with a `sail` that gave no order, it lists
the free army still standing that no sail of the turn asked whose march to one of the SAIL_TRIES ports
of the nation nearest it on its land is open (as `sailToArmy` asks), and prints the state hash at the
end. With `NOPROBE=1` the hash is the same (ae67a8ea after 120 days): the probe moves nothing.

- **HEAD, 120 days** (`h_cut_6421_head.log`, `.json`): one turn with a sail refused, day 7387, and on it
  one marching free formation never asked: division 16 at (998,241), land 278, a cell from Glasgow. The
  five sails of the turn (Norfolk, Baltimore, Tampico, Corpus Christi, Port-of-Spain) each asked the same
  four, 156, 778, 798 and 1365 on the US enclave at (1031–1032, 334–335) on land 56, cut off from the
  USA's six ports there (7.90f's read). The AT's HEAD figure: 1 in 120 days (7.90f read 1 in 90).

## The rule (ADR-652)

The ferry's sail to the army (`planFerry`'s `ferryGroup`, a group away from the army) asks the free army
on ported lands nearest first past those cut off: a formation whose march to all of its land's SAIL_TRIES
nearest ports is refused goes into a set of the turn (`cut`) that the turn's later sails pass over; the
sail ends at SAIL_TRIES formations whose march was open (their ports refused by sea), or once its searches
reach the turn's left (FERRY_SEARCHES less its refusals'). A sail that found new formations cut off does
not mark its port refused (`same`): the next group there asks past them. The board's sail (`board`, the
nearest on a port's land unable to march to it) is unchanged: it still asks its four, with no set.

- **Rule, 120 days** (`h_cut_6421_rule.log`): no sail refused in 120 days, so 0 turns with a marching
  free formation not asked (1 → 0). The history moves (hash ae67a8ea → 912614d8).
- **Day 7387 with the rule** (`h_turns_6421_rule.log`, `ferryTurns.ts` 90 days): the groups at Norfolk
  (196, 311) and Baltimore (330, 565, 705) sail, where on HEAD (`f_turns_6421.json`) all five sails were
  refused. Ferry turns 7, each with an order.
- **Landed** (`h_trip_6421.*`, `ferryTrip.ts` 90 days, against 7.90f's `f_trip_6421.*` on the same
  sim code): 87 either way, orders 104 → 109. The five new sails leave on day 7387, three days before the
  read ends: one division at Glasgow, as the plan said, does not move 7.90's bar.

## Test

`strandedFerry1938.test.ts`, "a group at a far port sails for the army past four on an enclave": Germany's
group at San Juan (made Germany's), four German divisions on a one-cell German enclave in Portugal, the
nearest of its army on Europe; the group is under way. Red without (it stands: `moving` 0).

## Timing

`.cache/prof90h/`, a year from the save, HEAD and rule bundles at once on separate P-cores, swapped:
invasion AI a tick 0.476 / 0.378 → 0.394 / 0.459 ms (by core set: 0.476 → 0.459, 0.378 → 0.394), longest
call 85 / 77 → 82 / 100 ms; mean tick 4.39 / 3.83 → 3.86 / 4.34 ms. Within the pairs' spread.

## Pin

Unchanged, 5161de24: seed 99's first year meets no sail past a cut-off formation.
