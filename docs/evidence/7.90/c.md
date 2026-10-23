# PLAN 7.90c: the ferry's way back

The rule (ADR-646, `ai/invasion.ts`, `planFerry`'s `ferryGroup`): a transport group away from the army
sails for it by the SAIL_TRIES (4) free formations nearest it **on a land with a port of the nation's
other than the group's** (`sailToArmy` takes no other). Before, the four nearest were taken whatever
their land, and from the far ports they were garrisons on Caribbean islands with no US port, so the
sail was refused every week (`a.md` §2).

Read with `tools/diag/ferryTrip.ts` over 90 days from critic run 12's saves, the commands of 7.90a/b:
`c_trip_1129.*` (`… 90 1129 critic/c12_seed1129_y10.bin USA 625163 746057`) and `c_trip_6421.*`
(`… 90 6421 critic/c12_seed6421_y20.bin USA`). HEAD's are 7.90b's `b_trip_*.*`. The probe's "sail
refused" lines now take the four as the rule does (none was printed on 1129: no sail was refused).

## The AT: the groups that land at Bathurst (1129 year 10)

| group | first day standing at Bathurst | standing there | under way again | HEAD |
|---|---|---|---|---|
| 365, 568, 571, 1015 (from Norfolk) | 3689 | 3 days | 3692 (ordered 3691), sail to Norfolk (3709), then St. John's, Boston | standing 52–62 days, to day 90 |
| 549 (from Kuujjuarapik) | 3679 | 6 days | 3685 (ordered 3684), sail to Norfolk (3702) | the same |
| 574 (San Juan → Norfolk → Baltimore) | 3682 | 3 days | 3685 | stood at San Juan 90 days |
| 1120 (Roseau → Baltimore) | 3689 | 3 days | 3692 | stood at Roseau 90 days |
| 1119 (Bissau → Baltimore) | 3696 | 3 days | 3699 | stood at Bissau 90 days |
| 1123 (Pearl Harbor → Hilo) | 3704 | 2 days | 3706 | – |

Every group that lands at Bathurst is under way within 2–6 days of landing (bar: 14). San Juan's, Roseau's and
Bissau's groups, which stood the 90 days on HEAD, sail to the mainland on the first turn.

## What moved (90 days)

| save | landed | of them from the piles | ferry orders | group-days at a port (P) / under way (L + E) | piles day 0 → 30 → 90 |
|---|---|---|---|---|---|
| 1129 year 10, HEAD | 8 | 4 (Baltimore) | 23 | 807 / 173 | 60/49 → 60/41 → 60/43 |
| 1129 year 10, rule | **19** | **15** (Baltimore) | **69** | 313 / 521 | 60/49 → 60/38 → **60/17** |
| 6421 year 20, HEAD | 78 | – | 80 | 2,198 / 472 | – |
| 6421 year 20, rule | **87** | – | 89 | 1,265 / 739 | – |

On 6421 the ferry has 8 turns, not 13: 5 of the USA's actor days went to Normandy landings and 6 to a
landing aboard, the ferry following (`c_turns_6421.json`, `ferryTurns.ts`), the groups free for them
now home. Left on 6421: 20–26 groups at Dakar, and later Bathurst's, refuse a `board` every turn (on
the African front's land, the army by them not sent to the port); 7.90b's read had those refusals
too: filed as PLAN 7.90f. The turn still tries every group on 6421 (never tried 0 on each late turn,
7.90b's figure) and its refusals searched at most 45 (bound 68; HEAD 18). 1129's 60 by Chicago do not move (7.90's bar on them, `a.md` §6).

Timing (`.cache/prof90c/`, pairs on separate P-cores, swapped, a year from each save): invasion AI a
tick, HEAD → rule, 1129 year 10 0.312 / 0.279 → 0.296 / 0.343 ms (longest 58 / 53 → 51 / 95 ms), 6421
year 20 0.462 / 0.380 → 0.374 / 0.454 ms (longest 65 / 71 → 68 / 72 ms).

The pin is unchanged (8a571863).

## 7.90f: the read (2026-10-22, on HEAD `a56637fc`, after 7.90d and 7.90e)

The stand at Dakar this note found (20–26 groups refusing a `board` days 56–90) is not on HEAD: its
history moved with 7.90d's and 7.90e's rules. Read again with the commands of 7.90c
(`f_trip_6421.*`, `ferryTrip.ts … 90 6421 critic/c12_seed6421_y20.bin USA`; `f_turns_6421.json`,
`ferryTurns.ts … 90 6421:critic/c12_seed6421_y20.bin:USA`):

- **The AT's figure**, groups at Dakar and Bathurst that gave no order on every turn they stood there,
  days 30–90: 27–29 on 7.90c's code, **3** on HEAD: 107, 141 and 285, which landed troops there from
  St. John's (ordered day 7373), stand at Dakar from day 7386 and refuse a `board` on the one turn
  there (7387; 9 searches each, 141 `same`). None stands at Bathurst. Why the African landings fell
  to these three groups is not read.
- **Why the board is refused** (`f_free_6421.log`, `ferryFree.ts 6421 critic/c12_seed6421_y20.bin USA
  docs/evidence/7.90/f_turns_6421.json 7387`): the free army on Dakar's land (landmass 56) is four
  formations on a US enclave at (1031–1032, 334–335), 5,700 + 1,708 + 16 + 16 men, which reach no
  front cell (free, the ferry's), but march to none of the USA's six ports on that land (Lisbon 90–91
  cells, Dakar 284, Bathurst 288, Conakry 293, Freetown 296: every one refused). The nearest's march
  to Dakar refused, `board` asks the sail to them (`sailToArmy`), refused for the same reason. The
  ferry boards only at a port (ADR-624's beachhead is where it lands, not where it boards), so
  nothing on that land can be lifted: the refusal is right. 7.90f is closed so; no rule, the pin
  unchanged.
- **Where the idle stand is now** (not 7.90f's bar): 9 groups at Port-of-Spain to day 90 and 6 at
  Baltimore from day 83 refuse a *sail* to the army. A group away from the army takes the four
  nearest of the free army on lands with a port of the nation's (7.90c's rule), and on day 7387 those
  four are the same cut-off remnants: each port's groups search them again (8 searches at Norfolk,
  Baltimore, Tampico, Port-of-Spain), while division 16 at Glasgow (land 278, no front), 1 cell from
  a US port it marches to, is never tried. Of the day's 21 free (140,277 men), 14 are garrisons on
  islands with no US port. Filed as PLAN 7.90h.
