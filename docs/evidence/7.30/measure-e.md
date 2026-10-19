# PLAN 7.30e — year 47's 'long' orders and year 44's refusals: nothing exact to keep (measure)

2026-10-19, code of `8140c87` (pin 94235073). `opCalls.ts` (now with the formation's state as
asked, and the flips near the two ends between a standing formation's asks of one cell for one
cell), 365 days from `.cache/730d/s732-y46.bin` (year 47) and `.cache/730/s732-y43.bin` (year 44);
`.cache/730d/opCallsE*_732_y4{4,7}.txt`. The runs were side by side or one after the other under
the probe: shares and counts, not times to compare with 7.30d's.

## 1. Year 47: the 'long' orders

The asks searched and answered 'long' (14.0 s of the year's 26.1 s of plans), by the formation as
asked (an order refused leaves the formation as it was, so its state after the ask is its state
at it):

| the formation | why no kept answer | calls | ms |
|---|---|---|---|
| on the move | none is kept for a formation on the move | 1,497 | 8,783 |
| standing | the record is of other cells | 1,003 | 4,857 |
| standing | none kept | 26 | 131 |
| others | | 26 | 135 |

- **On the move (63 %):** `asked` keeps nothing for a moving formation: its route starts at the
  cell it stands on or steps to, which changes as it walks, so an answer for one start is not one for the
  next. The planner asks again each day because the march's goal is more than a sector from the
  order's cell; the answer is 'long' and the formation goes on with its march. Nothing exact can
  keep this.
- **Standing (35 %):** of the asks searched, 979 (4.8 s) are the first from that cell for that
  cell: the attack cell (`attackCell`) and the cells diverted to move with the front each day.
  61 (0.3 s) ask again; all 61 had flips in the nodes of their two ends or those nodes' neighbours
  since the last ask (median 19), cells every corridor holds. A 'long' held by its corridor (as
  ADR-523 holds a refusal; a closing can turn 'long' into 'refused', and an opening into 'ok',
  so any flip in the corridor undoes it) keeps none of them.
- 3,225 'long' answers were already kept by the record (`same`), at 0.001 ms each.

## 2. Year 44: the refusals for another cell

Standing formations' refusals searched: 679 the first from that cell for that cell (3.2 s), 317
again (1.4 s), of which 23 (95 ms) with no flip near their ends: what a rule keeping a refusal
for every cell asked, by its corridor, could keep at most. Moving formations' refusals (101 orders,
23 marches from afar; 0.6 s) are not kept, as in §1.

## 3. Finding

No exact rule. What is left in the heavy late years is searches of new pairs of cells, and asks
of formations on the move. Keeping less of it would be a rule: e.g. a formation on the move whose
order was 'long' not asked again for some days, which changes when it turns (and the war). That
is ADR-525's option b's kind of change, not taken here. 7.30's band stays at 7.30d's 0.753
(0.785 by load).
