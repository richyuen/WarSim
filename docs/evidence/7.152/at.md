# PLAN 7.152b AT: critic run 17's 1307 probe in the page, against headless

HEAD `caf919a9` (code as `d47aa187` but for the save's format), production build served by `vite preview`.

## Headless (`tools/diag/workerDeterminism.ts 1307 26280 8760`, `plain` arm)

| year | hash |
|---|---|
| 1 | 08088a32 |
| 2 | 2aaffcd2 |
| 3 | 32760912 |

## In the page (`tools/diag/pageHash.ts`): the critic's sequence

Opened paused, London at 2,500 m/px, the mouse over it, six wheel steps out, a drag, the mouse away, then each year in
one `step` message (`critic/scripts/c17_h_misc.mjs`'s inputs).

- 1 year × 10 runs, 3 browsers at once beside the year-long harness: **10 of 10** `08088a32` (`pageHash_1307_1y.json`).
- 3 years × 10 runs, 4 browsers at once: **10 of 10** `08088a32 2aaffcd2 32760912` (`pageHash_1307_3y.json`).

## The worker's host in Node (`tools/diag/workerDeterminism.ts 1307 8760 168`)

The 1938 world of 1307 in `SimServer`, against `Sim` alone (year-1 hash, every week's hash compared):

| arm | what is between the steps | year 1 |
|---|---|---|
| plain | nothing (`Sim.step`) | 08088a32 |
| quiet | the server, `step` messages only | 08088a32, every week the same |
| start | every query at tick 0, the year in one message (the probe) | 08088a32 |
| every | every query after each week: snapshots of five views (tiers 0–3), paused pumps' labels and stats, inspect, 50 formations' panels, every nation's economy, every war's battle, the charts, the history | 08088a32, every week the same |

## Reading

20 of 20 page runs equal to headless every year; no input or query of the page changes the course. The critic's one
run in four (`critic/c17_h_misc_1307_3.log`, 4c6b44a9 against a6febaa8 on `cfedb50a`) is not reproduced here, and no
cause was found: nothing in the sim reads a clock or shared memory, the assets are checked by sha256, and a year's
`step` is one message, so nothing interleaves inside it. Its hashes are not those of run 16's build either
(`critic/c16_headless_1307.json`: 4fda327c). `tests/unit/workerQueries1938.test.ts` keeps the host's half: four days
of 1307 queried each day hash as the world stepped alone.
