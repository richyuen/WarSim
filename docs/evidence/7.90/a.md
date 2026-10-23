# PLAN 7.90a: the ferry's round trip, measured (read only)

Run 12's save `critic/c12_seed1129_y10.bin` (HEAD `e325276c`'s sim code), 90 days; 6421 year 20 the
same way for comparison. Tools: `tools/diag/ferryTrip.ts` (`trip_1129.*`, `trip_6421.*`) and
`tools/diag/ferryStuck.ts` (`stuck_1129_d42.log`, the state after 42 days). The one change to `src/`
is a read-only field of the ferry probe (`FerryTurn.island`, the free army at the turn's start); the
pin is unchanged.

Group states a day: `P` at a port of its own, nobody coming; `W` the same, a formation of its nation
marching to that port; `L` under way laden; `E` under way empty.

## 1. The round trip on 1129 year 10 (the USA, 12 transport groups, 288,000 men of room)

| step | days | read |
|---|---|---|
| ordered to the port: sent (day 3656) to aboard (3671) | 14 (mean 18.2 of those landed) | Norfolk's four groups `W` days 7–21; the four aboard marched from the Baltimore pile (§3), 12–18 cells off |
| aboard to sailing | 0 | aboard and under way the same day |
| at sea, Norfolk → Bathurst (the Gambia) | 18 | Kuujjuarapik → Bathurst 22; Kuujjuarapik → St. John's 9 |
| back | **never** | the five groups landed at Bathurst stood there 52–62 days, to the end (§2) |
| carried a trip | **1 division a group** | room 24,000, a division 12,460 (§4) |

In 90 days 7 divisions landed (4 from Norfolk, 2 from Kuujjuarapik, 1 to St. John's), 4 of them from
the Baltimore pile, none from the 60; the ferry gave 21 orders in 12 turns, and after day 30 0.88 a
turn. 8 more of the Baltimore pile, sent on days 3664 and 3671, reached Norfolk after its groups had
sailed and stand there with no group to day 90. The piles: 60 / 49 on day 0, 60 / 41 on day 30, 60 / 43
on day 90 (7.89's 53 is the most seen on the cell in its 30 days; 49 is the save's).

## 2. Why the groups stand at the far port and are not tried

**The way back.** A group away from the army (`ferryGroup`'s `sail`) sails for a port by the free
army's `SAIL_TRIES` (4) formations nearest it (`sailToArmy`). From Bathurst, San Juan, Bissau and
Roseau those four are garrisons on Caribbean islands where the USA holds no port (612, 618 on
landmass 510, 1321 on 529, 611 on 521; "ports 0" on every refused sail of `trip_1129.log`), so no port
is found and the sail is refused, every week. The army on the mainland (landmass 116, ~150 free
formations, 73 ports) is never among the four. 6421 the same: Roseau's and Port-of-Spain's four are
on landmass 503, no port.

**The turn's refusals.** The turn ends at `SAIL_TRIES` groups that gave no order (ADR-642). The groups
are sorted by whether their port is on a landmass of the free army (`onArmy`), then room: Nuuk's two
come first (Greenland holds two free formations, 610 and 1031, 120 cells off; their march to Nuuk is
refused) and refuse every turn; two more refusals (Bathurst's, San Juan's, Bissau's) end it.

| save | late turns (day 30–90) | groups at a port a turn | never tried a turn | orders a turn | free army |
|---|---|---|---|---|---|
| 1129 year 10 | 8 | 11.4 | 6.5 | 0.88 | 147–151 |
| 6421 year 20 | 9 | 30.6 | 26.3 | 0.22 | 75–82 |

Never tried on 1129: Roseau, Pearl Harbor (on every one of the 12 turns; Pearl Harbor's might act,
inferred from `ferryStuck.ts`, not read from a turn: Hawaii's three divisions stand by Hilo, on a
landmass with no front, and may march there) and three of Bathurst's five. On 6421 the
refusers are Freetown and Dakar (`board`) and Roseau and Port-of-Spain (`sail`); 6421's groups do sail
back from their first trip (24 laden 12 days on day 7318, standing 2 days, then home), but none of the
30 at Norfolk is tried after day 30.

## 3. The march to the port

- **1129's 49 stand at Baltimore** (746057 at (585, 364), within `AT_PORT_CELLS` of Baltimore at
  (588, 361)): a port of the USA where no group stands. The groups are at Norfolk, 16 cells on, so the
  ferry sends them marching 14 days, and those that reach Norfolk after its groups sail stand there
  (8 to day 90). Land formations standing by a port with no group: 61 on day 0, 58–68 through the 90
  days.
- **1129's 60 by Chicago** (625163, (523, 305)): the nearest ports are on the Great Lakes (Milwaukee 31
  cells, Chicago 40, Gary 45, Cleveland 77, Buffalo 84), whose water is its own (`waterKeys` 423–425;
  the Atlantic's and Pacific's is 1); the nearest port on the sea, Baltimore, is 121 cells off, about
  60–85 days' march at 1.4–2.1 cells a day. `board` sends the free army nearest the group's port first,
  so none of the 60 is sent while one of the 49 stands nearer.
- **6421's 61 march to Norfolk** (70 with those standing at a port waiting, `stillMarching`) from Quebec and Labrador (about 170 cells): on the march from day 7304,
  3–15 days still to go on day 7390 (`marchingLeft` in `trip_6421.json`).

## 4. A division over half a group's room

`TRANSPORT_MEN` (2,000 a transport, `systems/amphibious.ts`) says a group's 12 carry "two infantry
divisions of 1938", 24,000; the 1938 infantry template is 12,460 men (`templateStrength`), and 130 of
the USA's 169 land formations are over 12,000. Two of them (24,920) do not fit: every landed trip
carried one a group, half what the room was set for.

## 5. The transports the economic AI buys

`wantsFerry` (ADR-614) is false every day of the 90 (`wantsTransport` too) with 131,961 gold on day 0 and
none in training: it counts only the army on landmasses with a port of its own and no front cell
(`homes`), and the USA has 9 front cells on the mainland (landmass 116, beside an enemy its army does not
reach, PLAN 7.79c) and 91 in Africa (56). So the mainland's ~150 free formations, the ferry's since
ADR-636, are not counted, and no transport is bought. 6421 the same (22,189 gold, 34 groups).

## 6. The AT's bar, by arithmetic

7.90's bar is 1129's two piles (6421 and 7019 are at 0 since 7.89). `piles.ts` counts those standing on
the cell, so an order off it counts: under 30 by day 30 needs 20 of the 49 and 31 of the 60 ordered off.
A group waiting for marchers (`W`) sends no more; each sends one division a trip (§4), and a trip is
14 days to board, 18 at sea and as long back. With every cause above mended, the USA's 12 groups order
at most 12–24 divisions off in 30 days, and the 60 come only after the 49. **51 divisions in 30 days
needs about 26 groups at the Atlantic ports with room for two each.** 7.90's bar on the 60 is out of
reach by the ferry's rules alone; the parts' bars below are scoped to what each mends, and 7.90's own
read once they are in.

## 7. The parts it names

| part | cause | bar (read the same way) |
|---|---|---|
| 7.90b | the turn's refusals spent on the same groups (§2) | 1129 y10 and 6421 y20, days 30–90: groups never tried a turn 6.5, 26.3 → 0 |
| 7.90c | the way back past port-less islands (§2) | 1129 y10: Bathurst's five groups under way within 14 days of landing (52–62 days standing) |
| 7.90d | a division over half the room (§4) | 1129 y10: divisions a group carries a trip 1 → 2 |
| 7.90e | the ferry's transports not bought for 7.79c's army (§5) | 1129 y10: `wantsFerry` false → true on day 0; a transport group in training by day 30 |
