# PLAN 7.130: the top five stand still (2026-10-26)

Stasis as the critic reads it (`critic/scripts/c15_cmp.py`): at each year's end the five nations holding
the most cells by controller, as a set; the longest run of years with the same set. Land moved late: the
cells whose controller changed year on year (`net`, the critic's `flipped`) summed over years 26–30,
÷ 627,843 land cells. Tool: `tools/diag/churnAt.ts <seed> 30` (1938 on), `tools/diag/stasisFrom.ts
<save> <years>` (from a save; new). Raw output in `.cache/st130/` (not committed).

## The read (critic run 15's long worlds)

In the critic's eight worlds with a stasis of 13–19 years the five are the Soviet Union, the United
States, Canada and two of Denmark (Greenland, 5.0–5.4 % of the cells unchanged for 20 years), Australia
(about 4 %) and France; the sixth (Brazil 3.8 %, Argentina, the Netherlands, Italy) as still.
`stasisFrom.ts` on `critic/c15_seed4513_y10.bin`, years 11–14: Canada, Denmark, Australia and Brazil
each at war all year (two wars at once for most), in alliance wars with Japan, Turkey, Siam, Portugal,
England or Saudi Arabia, enemies on other continents; their cells the same to 0.3 % in four years. A
far ally's war held each of them: no front to fight on, its war slots (MAX_WARS) and the WARS_PENALTY
taken, never at peace so never restless (`lastFought`), and no war it could fight.

## HEAD (`3895b4fa`) on the AT's seeds, 1151–1160 × 30 years

| Seed | Longest | Years | The five | Battle share y10–30 | Land moved y26–30 |
|---|---|---|---|---|---|
| 1151 | 7 | 14–20 | SOV CHI AST CAN USA | 1.89 % | 49.3 % |
| 1152 | 8 | 8–15 | SOV FRA DEN CAN USA | 2.02 % | 49.0 % |
| 1153 | 10 | 8–17 | SOV FRA CHI CAN USA | 2.17 % | 43.5 % |
| 1154 | 7 | 5–11 | SOV DEN CAN USA BRA | 1.70 % | 28.5 % |
| 1155 | 10 | 21–30 | GER SOV FRA CAN USA | 1.77 % | 58.7 % |
| 1156 | 12 | 18–29 | SOV DEN JAP CAN USA | 1.84 % | 57.3 % |
| 1157 | 11 | 20–30 | SOV DEN AST CAN USA | 1.51 % | 91.4 % |
| 1158 | 7 | 1–7 | SOV DEN AST CAN USA | 1.56 % | 50.5 % |
| 1159 | 8 | 6–13 | SOV DEN AST CAN USA | 1.73 % | 48.9 % |
| 1160 | 3 | 1–3 | SOV DEN CHI CAN USA | 2.50 % | 27.8 % |

Longest **12** (bar at most 12), mean **8.3**; least land moved late **27.8 %** (bar 20 %). HEAD meets
the figures on these ten seeds; the critic's 48 put 8 worlds (17 %) over 12, so ten seeds clear by
chance about one time in six.

## The rule from the critic's saves (A/B, 20 years from each `critic/c15_seed*_y10.bin`)

The rule (ADR-721): a war's member, not a side's leader, whose realm meets the other side on no land
front and holds none of its land (nor it any of the realm's) for MEMBER_FRONTLESS_DAYS (365) running
makes a separate peace. Both arms from the same save; HEAD in a worktree at `3895b4fa`.

| World | HEAD longest (changes of the set) | Rule longest (changes) |
|---|---|---|
| 1307 | 16 (3) | 9 (7) |
| 2417 | 7 (6) | 7 (11) |
| 4561 | 16 (2) | 12 (3) |
| 4789 | 10 (4) | 10 (3) |
| 6737 | 9 (6) | 9 (7) |
| 8693 | 18 (1) | 4 (11) |

Over 12 years: HEAD 3 of 6, the rule 0 of 6; mean longest 12.7 → 8.5; changes of the set 22 → 42.

## The AT: the rule on 1151–1160 × 30 years (from 1938)

The rule as `rule.patch` (its unit test `separatePeace1938.test.ts.txt`: green with it, red with its
call taken out, at the count of quiet days). Same seeds and tool as HEAD's table above.

| Seed | Longest | Years | The five | Battle share y10–30 | Land moved y26–30 | Wars a day (y2–30) |
|---|---|---|---|---|---|---|
| 1151 | 7 | 24–30 | SOV DEN CHI CAN USA | 2.25 % | 40.7 % | 6.46 (HEAD 7.66) |
| 1152 | 5 | 20–24 | GER SOV ENG CAN USA | 1.83 % | 50.1 % | 7.88 (6.04) |
| 1153 | 8 | 18–25 | SOV FRA NED CAN USA | 1.30 % | 70.5 % | 9.37 (7.46) |
| 1154 | **13** | 11–23 | SOV DEN CAN USA BRA | 2.53 % | 50.1 % | 7.20 (6.82) |
| 1155 | 7 | 20–26 | SOV JAP AST CAN USA | 1.90 % | 66.0 % | 6.80 (8.33) |
| 1156 | **14** | 1–14 | SOV DEN AST CAN USA | 2.02 % | 67.5 % | 8.43 (9.89) |
| 1157 | **19** | 5–23 | SOV DEN CHI CAN USA | 1.93 % | 34.4 % | 9.97 (8.77) |
| 1158 | 7 | 1–7 | SOV DEN AST CAN USA | 1.77 % | 48.2 % | 7.79 (7.35) |
| 1159 | **14** | 14–27 | SOV DEN AST CAN USA | 2.05 % | 38.2 % | 8.29 (6.61) |
| 1160 | 5 | 19–23 | SOV ENG RAJ CAN USA | 1.73 % | 64.8 % | 8.86 (7.54) |

Longest **19** (bar 12; HEAD 12), mean **9.9** (bar: not above HEAD's 8.3); least land moved late 34.4 %
(bar 20 %, met). **Missed** on two of three clauses.

**Why:** in the rule's long spans Denmark is at war 243–283 days a year, Canada 284–321, Australia 189–279,
with 0.02–0.08 land formations engaged: a far member that makes its separate peace is called into the
next war of its alliance or guarantor within weeks, and its land is as far from any enemy as before. The
gain from the critic's saves (6 worlds, 3 over 12 → 0) does not hold from 1938 on unseen seeds; ten
seeds read the longest stasis to a few years either way.
