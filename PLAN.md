# WarSim — Phased Plan

Rules: each task is small and verifiable. `AT:` is the acceptance test that must
pass before ticking; it names a number and a stop (a figure, its bar, the run that reads it;
ADR-554). Work top-down, and split a task if it grows past one iteration, at most twice (7.35a,
7.35a1, no deeper); a dimension task has 20 commits (PROMPT "KEEPING ITERATIONS SHORT").
"Gate" = the full suite (tsc, eslint, vitest, build, parity) passes.
Balance sweeps were suspended while phases 2–6 were built (ADR-58); in Phase 7 they run again
(PROMPT "KEEPING ITERATIONS SHORT": tune on `sweep:quick`, one full sweep per task on unseen seeds).

## Phase 0 — Foundations & benchmarks

## Phase 1 — Baseline parity

### 1A Data & scenario

### 1B Core sim

### 1C Presentation & tools

## Phase 2 — Semantic zoom

## Phase 3 — Armour

## Phase 4 — Naval

## Phase 5 — Air

## Phase 6 — Nuclear AI

## Phase 7 — Balance, polish, soak

Run 11's (report of 2026-10-21 on `dd3b730`, `critic/CRITIC_REPORT.md`; run 10's R10-B2 fixed,
R10-B1 and R10-B3 mostly; naval 6 → 7, aircraft 6 → 7): R11-B1 and R11-B2 are PLAN 7.49 and 7.50.
The dimensions under the bar: emergent 6 is 7.49's (ADR-583; 7.40 closed), naval 7 is 7.41 (moved
here, ADR-577), aircraft 7 is 7.51, AI nuclear use 7 beyond R11-B2 is 7.52. A task each, split
when taken up:

Run 12's (report of 2026-10-22 on `896ff779`, `critic/CRITIC_REPORT.md`; R11-B2 closed; map visuals
and performance 7 → 6): R12-B1 and R12-B2 are PLAN 7.79 and 7.80; the dimensions under the bar, beyond
them, are 7.81–7.86. A task each, split when taken up:

- [ ] 7.79 The land war after year 1, again (R12-B1; R11-B1 not fixed by 7.49): on the critic's same 48
  checkpoints (years 10 and 20 of run 11's 24 seeds) 1.52 land formations engaged of about 358 of nations
  at war, with 7.3 wars running; daily over 30 years on 32 worlds 33.7 engaged in year 1 and 2.11 after
  (5.1 a war in year 1, 0.34 after). Seed 6421's year-21 Germany–Soviet war 0–2 engaged over 60 days; 60
  US divisions (714,480 men) idle in one place at war (1129, year 10). Evidence:
  `critic/c12_cmp_checkpoints.json`, `c12_cmp_all.txt`, `c12_engaged_w1.json`–`w3.json`,
  `c12_y_6421_gersov.json`, `c12_stacks_y10_w1.json`. The critic's fix: a nation at war sends its
  standing army to its fronts and holds a front line it fights for. Measure first what keeps the army
  from the front (where the formations of nations at war stand late, and why the AI leaves them). AT:
  on 10 unseen seeds × 20 years, engaged land formations a war, mean of daily samples in years 2–20, at
  least a tenth of year 1's (HEAD's 0.34 / 5.1 = 0.067, read on the same seeds first); no pile of 30 or
  more divisions of a nation at war in one place for 30 days; a unit test, red without; the gate green.
  In parts (7.49's parts moved the armies to the landmass and left engaged per war flat, 0.134 → 0.137;
  what 7.49a left open is the second factor of engaged per war, engaged per armed war, about 20 in year
  1 and 0.4 late: in a late armed war the armies near the front stand apart, 115 of 140 beyond 15 cells;
  order b, d, c):
    - [x] 7.79a Measured, on run 12's saves (HEAD's sim code) and year 1 of 6421 and 7019
      (`tools/diag/frontSpread.ts`, `OP_PROBE.sectors`, `docs/evidence/7.79/`): per plan of a nation at
      war, its sectors, those threatened, the formations allotted, the share of them in threatened
      sectors before and after "every sector gets one", the threatened sectors manned and attacking;
      and the 1129 year-10 pile of 60 US divisions traced. AT: the table, year 1 against late, and the
      cause it names, each a part with its own AT; no rule: the pin unchanged.
      Measured (`docs/evidence/7.79/measure.md`): the share of the allotted in threatened sectors 0.58–0.74
      in year 1, 0.006–0.23 late; "every sector gets one" not it (late the same before and after); the
      weights 1 + threat / 10,000 lose to fronts of 120–920 sectors. The US piles: their class reaches
      none of the sectors (overseas, or closed ground), and the ferry needs a landmass with no front.
    - [x] 7.79b The allotment by where the enemy stands, within the range (measure §2.1 b): a class's
      formations go to the threatened sectors it reaches within the range first, in proportion to
      threat, and the empty front gets what is left over them. AT: on the 7 late saves of measure
      §2.1, the formations allotted to threatened sectors (`allottedThreatenedBefore`) at least 0.5 of
      what the threatened sectors in range could take on each (read on HEAD first); in year 1 of 6421
      and 7019 the share in threatened sectors not under HEAD's (0.741, 0.578); engaged per war on the
      saves read (`frontSpread.ts`); a unit test (red without); the ADR; the pin's entry; `--profile`
      against `9490fd78` (before the probe).
      Done (ADR-634, `docs/evidence/7.79/b.md`): 1.0 on all 7 (HEAD 0.88–1.63 on 6 of them: the
      counts overlap, so the figure passed on HEAD); placed in threatened sectors of those within
      range 0.37–0.46 → 0.51–0.85 (days 21–30: 0.02–0.68 → 0.28–1.0), kept marches into empty
      sectors yielding (they took half), not those begun beyond the range; year 1 from one day-60
      save 0.741 → 0.895, 0.578 → 0.857; engaged per war late 0–0.46 (little moved: 7.79d's); pin
      a4ff4661 → e6c74731; operational AI about a tenth dearer on the long fronts.
    - [x] 7.79d The march to a threatened sector beyond the range (measure §2.1 a): late 88–98 % of the
      threatened sectors on 1129 and 2081 year 20 and 6421 year 20 have no formation of the planner
      within DEPLOY_RANGE_CELLS, and the marches from afar serve only sectors with nobody. A far
      formation (standing, its day in MARCH_DAYS) marches to the nearest threatened sector its class
      reaches when one has fewer of the planner than its threat's share. AT: on those 3 saves the
      threatened sectors with a formation of the planner within the range after 30 days at least
      twice HEAD's (`frontSpread.ts`, `inRangeThreatenedAPlan`); engaged per war read; a unit test
      (red without); the ADR; the pin's entry; `--profile`.
      Closed not done (ADR-635 proposed, BLOCKERS 2026-10-22; `docs/evidence/7.79/d/measure.md`): the
      far formations that reach a threatened sector on their landmass (0.96, 0.15, 0.17 a far plan) stand
      206–353 cells from it, none within 110; a march of 1.4–2.1 cells a day puts none in range in 30
      days. No rule written; the pin unchanged. The rule over a season is PLAN 7.87, the user's.
    - [x] 7.79c The ferry from a fronted landmass whose front the army cannot reach (measure §3): the
      ferry (ADR-612) takes far formations whose class reaches no sector of the nation, as from a
      landmass with no front (read first: whether `planLanding` carries to a port on the boarders' own
      landmass, else the rule is a sea march to the far port). AT: piles of 30 or more of a nation at war on one cell 30 days running
      on 1129 year 10, 6421 year 20 and 7019 year 10 (`piles.ts --days 30`) 3 → 0; a unit test (red
      without); the ADR; the pin's entry.
      Closed not done (ADR-636, BLOCKERS 2026-10-22; `docs/evidence/7.79/c.md`): the rule is in (free for
      the USA's ferry 20 → 157 on 1129 year 10, 16 → 210 on 6421 year 20; a port from which no front cell
      is reached takes no ferry); piles 3 → 3. The turn's one transport group is one that cannot act
      (Nuuk; Port-of-Spain, Roseau), and one group a turn carries two of 1129's 60 divisions: PLAN 7.88.
      Pin e6c74731 → e66bef2e.
    Then, after PLAN 7.88, 7.89 and 7.90 (7.87 dropped, ADR-635 b), 7.79's AT on 10 unseen seeds × 20
    years (HEAD's figure read on them first).

- [ ] 7.91 Blocks stacked on one enemy out of its view (found at 7.90g, `docs/evidence/7.90/g.md` "The gate"):
  with 7.90g's rule (`docs/evidence/7.90/g.patch`) seed 99's 60-day world of `deploy.test.ts` has 97
  formations in contact, 86 (89%) sharing a view at 20 m/px with their nearest enemy, against the test's
  bar of 90% (HEAD: 69 of 70). All 11 are Chinese blocks against two Japanese formations
  (`tools/diag/deployView.ts`, `g_deploy_seed99_rule.log`): three stacked on one cell 1.0–1.5 cells from
  393, its block deployed against another, the Chinese blocks 1.0–1.35 apart from it with none of either
  seen; seven from four cells against 366 (landed day 12.9, 45 elements), 0.75–1.15 apart. HEAD has one
  such pair (410 against 393, `g_deploy_seed99_head.log`). A deploy rule (`deployOf`, ADR-89, ADR-133),
  not the ferry's. AT: with g.patch applied, `deploy.test.ts` all green (the day-60 share ≥ 0.9, from
  0.887) and green on HEAD; a unit test of the case (several divisions on one cell coming up to an enemy
  whose block faces another, each in one view with it), red without; the ADR. Then 7.90g is committed
  from g.patch (its AT read, its pin f9344f0e).
  Ruled, not committed (`docs/evidence/7.91/case.md`, `patch`, ADR-650 in the patch): the lines and
  files of a stack counted with those from within 60° of its own side; HEAD 69/70 → 96/99, g.patch 86/97
  → 72/75; the test red without (0.87 cells against 0.72); pin 5161de24 → 41d60509. The whole unit suite
  1870 of 1871: `nukePoland1938` 5591, a nuclear weighing cause: waits on ADR-651 (the user's; PLAN
  7.92's measure). With (a) the test's last assertion goes and this is committed from its patch; with
  (b) after that rule. Meanwhile the loop takes PLAN 7.90h.
- [ ] 7.90 The ferry's lift short of the army (found at 7.89; R12-B1): on critic run 12's 1129 year 10 the
  USA's 12 transport groups hold 288,000 men (24,000 each) against about 1.35 million in two piles of a
  nation at war (60 divisions at 625163 by Chicago, 53 at 746057 by Norfolk). A round trip of Norfolk's
  four groups (the divisions sent to the port on one turn, aboard on the next, about 20 days at sea)
  carries 4–8 divisions; in 30 days the 53 fall to 41, and the 60, never the nearest the port, do not
  move (`docs/evidence/7.89/a.md` §3). AT: piles of 30 or more of a nation at war on one cell 30 days
  running on 1129 year 10, 6421 year 20 and 7019 year 10 2 → 0 (`piles.ts --days 30`); a unit test (red
  without); the ADR; the pin's entry; `--profile`. In parts:
    - [x] 7.90a Measured, on 1129 year 10 over 90 days (read only): the US groups' round trip by step
      (days marching to the port, waiting to board, at sea, back), the transports the economic AI buys
      the USA (`transportWant.ts`; PLAN 7.49d3, 7.66), and what else stands between the piles and the
      lift (the 60's march to a port, any port of the USA's nearer them). AT: the table, and the rule it
      names, each a part with its own AT; no rule: the pin unchanged.
      Measured (`docs/evidence/7.90/a.md`, `tools/diag/ferryTrip.ts`, `ferryStuck.ts`): 14–15 days to
      board, 18 at sea to Bathurst, and no way back (the five groups there stood 52–62 days); one
      division a group (12,460 in 24,000); 7 landed in 90 days, 4 from the Baltimore pile; after day 30 0.88
      orders a turn (6421 year 20: 0.22). The 49 stand at Baltimore, a port with no group; the 60's
      nearest sea port is 121 cells off (the Great Lakes' water its own). `wantsFerry` false with 131,961
      gold. 7.90's bar on the 60 is out of reach in 30 days by the ferry alone (§6: ~26 groups needed).
    - [x] 7.90b The turn's refusals (a.md §2): the turn ends at `SAIL_TRIES` groups that gave no order,
      and the same ones refuse first every week (Nuuk's two, sorted first by `onArmy`, then Bathurst's,
      San Juan's, Bissau's; 6421: Freetown, Dakar, Roseau, Port-of-Spain), so the rest are never tried.
      AT: on 1129 year 10 and 6421 year 20, days 30–90 (`ferryTrip.ts`), the groups at a port never tried
      a turn 6.5 and 26.3 → 0, the turn's cost bounded (`--profile`, the invasion AI's longest call);
      a unit test (red without); the ADR; the pin's entry.
      Done (ADR-645, `docs/evidence/7.90/b.md`): the turn is bounded by its refusals' route searches
      (FERRY_SEARCHES 68), a refusal at a port taken by the groups after it there until an order; never
      tried 6.5 → 0 and 26.3 → 0 (every turn); the refusals searched at most 18 a turn. The groups now
      tried refuse the sail back (7.90c's), so the landed barely move (7 → 8, 77 → 78). The pin unchanged.
    - [x] 7.90c The way back (a.md §2): a group away from the army sails for a port by the free army's 4
      formations nearest it, and from Bathurst, San Juan and Roseau those are garrisons on islands with no
      port of the nation, so the sail is refused every week and the mainland army never tried. AT: on 1129
      year 10 the five groups that land at Bathurst under way within 14 days of landing (HEAD: standing
      52–62 days, to day 90); a unit test (red without); the ADR; the pin's entry.
      Done (ADR-646, `docs/evidence/7.90/c.md`): the four tried are the nearest of the free army on a
      land with a port of the nation's; every group landing at Bathurst under way within 2–6 days, San
      Juan's, Roseau's, Bissau's on the first turn; 1129's landed 8 → 19 (15 from the Baltimore pile),
      piles on day 90 60/43 → 60/17; 6421's 78 → 87. The pin unchanged.
    - [x] 7.90d A division over half the room (a.md §4): `TRANSPORT_MEN` gives a group 24,000 men, "two
      infantry divisions of 1938", and the template is 12,460, so every trip carries one a group. The rule
      changes every landing's lift too (ADR when taken up). AT: on 1129 year 10 the divisions a group
      carries a trip (`ferryTrip.ts`, `landed` by fleet) 1 → 2; a unit test (red without); the ADR; the
      pin's entry.
      Done (ADR-647, `docs/evidence/7.90/d.md`): a transport 2,100 men, a group 25,200; on 1129 year 10 a
      trip 1.12 → 1.87, trips of two 2 → 13 of 15 (the mode 2), landed 19 → 28, piles on day 90 60/17 →
      60/7; the two of one are three groups splitting a port's last four (7.90g). 6421: 87 landed either
      way. Pin 8a571863 → 5ea2c9d8.
    - [x] 7.90e The ferry's transports (a.md §5): `wantsFerry` counts only the army on landmasses with a port
      and no front, not the army on a fronted landmass that reaches no front (the ferry's since ADR-636),
      so it is false on 1129 year 10 with ~150 such formations and 131,961 gold. AT: on 1129 year 10
      `wantsFerry` true on day 0 and a US transport group in training by day 30 (HEAD: false, none); a unit
      test (red without); the ADR; the pin's entry.
      Done (ADR-648, `docs/evidence/7.90/e.md`): on a front's land with a port of its own, the standing
      formations that reach no front cell (`frontReach`, the ferry's test) count against the room; on 1129
      year 10 `wantsFerry` false → true on day 0, groups in training 0 → 1 from day 10. Pin 5ea2c9d8 →
      5161de24.
    - [x] 7.90f The board refused at Dakar (found at 7.90c, `docs/evidence/7.90/c.md`): on 6421 year 20,
      with the way back mended, 25 US groups stand at Dakar (and 2–4 at Bathurst) from day 56 to day 90
      and refuse a `board` every turn (9 searches each, no order), on the African front's land with free
      army on it. Read first why (`ferryTurns.ts`, `ferryStuck.ts`: the board's target, the nearest's
      march to the port); then the rule it names. AT: on 6421 year 20, days 30–90 (`ferryTrip.ts`), the
      groups at Dakar and Bathurst that give no order on every turn they stand there 27–29 → 0, or the
      read shows the refusal right (no formation there the ferry should carry: then closed so, the
      reason in c.md); a unit test (red without) with a rule; the ADR; the pin's entry.
      Closed so (`docs/evidence/7.90/c.md` "7.90f: the read"): on HEAD the stand moved with 7.90d/e; the
      figure 27–29 → 3 (107, 141, 285 at Dakar from day 7386, one turn), Bathurst 0. The free army on
      Dakar's land is four remnants (7,440 men) on a US enclave at (1032,335) that march to none of the
      USA's six ports there (`ferryFree.ts`): the ferry boards only at a port, so the refusal is right.
      No rule; the pin unchanged (5161de24). The idle stand is now sails refused: 7.90h.
    - [ ] 7.90g A port's army split over its groups (found at 7.90d, `docs/evidence/7.90/d.md`): on 1129 year
      10, four divisions of the Baltimore pile sent on day 3664 were aboard three groups at Norfolk (365,
      568, 571) on day 3713, 2 / 1 / 1, where two groups had room for the four; 568's and 571's tries of
      the day-3712 turn were sends (a route search), and by what rule the four went aboard which group is
      unread. 6421 year 20's 27 trips of one are unread too. Read first whose
      the trips of one are on both saves (the port's free army when the group went, the room left); then the
      rule it names. AT: on 1129 year 10 and 6421 year 20 (`ferryTrip.ts`, `landed` by fleet and sail day)
      the trips of one that left at their port a free formation the group had room for (1129: 2; 6421:
      read first) → 0, or the read shows each right (closed so, the reason in the note); a unit test (red
      without) with a rule; the ADR; the pin's entry.
      Read and ruled, not committed (`docs/evidence/7.90/g.md`, `g.patch`, `tools/diag/ferrySplit.ts`):
      `tryLanding` took `via` as one more group, so with `fleet` full the next went on another group at
      the port, which sailed with it alone; in g.patch `via` named is that group or a refusal. AT met:
      1129 1 → 0, 6421 21 → 0 (strict; loosely 2 → 0, 23 → 1, the one right); test red without; ADR-649
      and pin f9344f0e in the patch. The gate red on `deploy.test.ts`'s day-60 share (0.887 < 0.9) on the
      new history, a deploy cause: waits on PLAN 7.91 (itself on ADR-651), then applied (its `src/` and
      `tests/unit/` parts; the DECISIONS and pin hunks by hand, the pin read again) and committed.
    - [x] 7.90h The sail to cut-off remnants (found at 7.90f, `docs/evidence/7.90/c.md` "7.90f: the read"): a
      group away from the army sails for the four nearest of the free army on lands with a port of the
      nation's (7.90c's rule), whether or not they march to one. On 6421 year 20 day 7387 those four are
      the remnants on landmass 56 cut off from all six US ports there: the groups at Norfolk, Baltimore,
      Tampico, Corpus Christi and Port-of-Spain each search them again (8 searches; the rest `same`) and
      are refused, while division 16 at Glasgow, 1 cell from a US port it marches to, is never tried; 9
      groups at Port-of-Spain and 6 at Baltimore stand to day 90. AT: on 6421 year 20 over 120 days
      (`ferryTrip.ts`, `ferryFree.ts` on each turn with a sail refused) the turns on which a sail was
      refused while a free formation that marches to a port of its land was not tried (HEAD: 1 in 90
      days, day 7387; the 120 read first) → 0; a unit test (red without) with a rule; the ADR; the pin's
      entry. One division: it does not move 7.90's bar on the piles.
      Done (ADR-652, `docs/evidence/7.90/h.md`, `tools/diag/sailCut.ts`): the ferry's sail asks past the
      formations cut off from their land's ports, kept in a set of the turn, within the turn's searches
      left; HEAD 1 in 120 days → 0 (no sail refused), day 7387's five sails ordered; landed 87 either
      way. The pin unchanged (5161de24).
    Then 7.90's AT, read after 7.90b–h (a.md §6: on the 60 it is likely missed; that goes to BLOCKERS).
    Read (`docs/evidence/7.90/at.md`): 2 → 2, missed (BLOCKERS 2026-10-23). The Baltimore pile 53 → 31 by
    day 30 (7 by day 85), the 60 by Chicago unmoved; the same with g.patch. Both piles predate the rules;
    the bar's scope is the user's (ADR-653: (a) judged from 1938 by 7.79's AT, recommended; (b), (c) a
    PLAN 7.93). Open only for 7.90g (ADR-651).

- [ ] 7.82 Emergent dynamics (emergent 6, needs 7, beyond R12-B1 and R12-B2): the longest stasis 21
  years, two worlds of 32 over 20 (was one); the churn is statelets and walk-ins, not fronts
  (`critic/c12_cmp_all.txt`, `c12_summary_all.txt`). Taken up after 7.79 and 7.80, re-read on their HEAD
  first. AT: on 10 unseen seeds × 30 years no stasis over 15 years (the critic's measure, read the same
  way), and the share of cells changing hands by a front battle in years 10–30 measured and at least
  HEAD's; the gate green.

- [ ] 7.94 The operational AI's cost on the busier world (found at 7.83's AT; performance 6, needs 7;
  waits on ADR-654: taken under (a) or (c), dropped under (b)): 0.60 ms a tick on HEAD's year-4 world of
  seed 99 (31 % of the tick), the same under `dd3b730`'s rules (`docs/evidence/7.83/at.md` §3).
  Profile it by function there first (`node --cpu-prof`), then cut what dominates without changing an
  outcome. AT: operationalAi's mean a tick on a year from that save at most 0.40 ms (profiled, swapped
  pairs against HEAD's in the same session); the year's hash f278491d and the pin unchanged
  (5161de24); seed 7 × 3 years, the random and toy worlds the same hash; the gate green.
- [ ] 7.84 Naval (naval 7, needs 8): a carrier strike's row, clicked, shows two US destroyer counters and
  no aircraft (`sorties` 0 at 84 m/px, `critic/shots/c12n4_8693_rowless_clicked.png`); the Japan–USA
  battle at 85 m/px shows the American side as a pale ring and nothing else
  (`c12n_8693_JAP_USA_0_live.png`); late sea battles 13.29 → 9.30 a world-year, wars of two navies
  1.14 → 0.29 (`c12_fleets.json`). AT: an e2e spec on seed 8693's Japan–USA carrier strike, red before:
  clicking its row shows the striking aircraft and both sides' ships at the zoom it opens; on 10 unseen
  seeds × 20 years late sea battles a world-year not below `dd3b730`'s on the same seeds; the gate green.
  In parts (one cause each):
    - [x] 7.84a The row's frame: it centred the struck fleet 2.4 cells across, the carrier up to 250 km
      off (on 8693 the Japanese fleets ~10 cells away, off the screen). AT: `carrierStrikeView1938.spec.ts`
      on 8693's Japan–USA strike, red before (0 Japanese ships): from the row both sides' ships on the
      screen (> 0 each); `carrierStrikeRow1938.spec.ts` green; the pin unchanged (view only).
      Done (`ccbb3623`): the snapshot's sea row carries the carrier–target box (SEA_STRIDE 24), framed with
      STRIKE_MARGIN 1.2 cells; 8693 0 → 50 Japanese ships beside 16 American at 214 m/px; 2251 at 396 m/px
      (the T1–T2 band: both sides as counters).
    - [x] 7.84b The wing's flight: drawn only about each strike (`carrierStrikes`, `over` 0), 250 km at
      380 km/h in the air 1.3 hours of every 4. AT: the spec's planes of the striker on the screen from
      the row and at each of the next 4 hours (HEAD: 0, 2, 0, 0); `carrierStrikes1938.test.ts` red without
      (a flight in the air at every quarter-hour the page plays while the strike stands); the pin unchanged.
      Done (`afdb7f3a`, ADR-655): each flight over its target the cycle's hours its flights out and back
      leave; the spec's planes 2, 2, 2, 2, 2; the unit test red on HEAD at hour 44.75.
    - [ ] 7.84c Late sea battles: 13.29 → 9.30 a world-year, wars of two navies 1.14 → 0.29
      (`critic/c12_fleets.json`). Read first whether the fall is in wars of two navies (7.79's land war)
      or in battles a naval war (a naval rule). AT: the parent's second bar, or the measured cause to
      the numbered task that owns it.
- [ ] 7.85 Aircraft (aircraft 7, needs 8): air battles after year 1 153 a world-year against 2,853 in year 1
  (0.054; 7.51b closed not done on the land-war cause, BLOCKERS 2026-10-22); a carrier strike shows no
  aircraft (7.84 shares the case). Taken up after 7.79, re-read on its HEAD first. AT: on 10 unseen seeds ×
  20 years air battles a year in years 2–20 at least a tenth of year 1's, or, if 7.79's land war does
  not carry the air war there, the measured cause and the choice of 7.51b's (c) (an air war not tied to
  the land war) to the user; the gate green.
- [ ] 7.86 AI nuclear use (aiNukes 7, needs 8, beyond R11-B2): bursts on the same 24 seeds 188 → 497
  (20.7 a world, 31 of 32 worlds); bursts killing over ten times more civilians than men 61 → 109; a
  million or more civilians 4 → 8 (Germany on the Low Countries 3,090,000 civilians for 337 men at
  utility 0.164, 5861; Germany on the Netherlands then Denmark in 7 days, 2,284,000 and 1,340,000 for 0
  and 473 men at 2.04 and 1.83, 2347). The critic's design objection (cities struck as massacres; ADR-632
  b keeps output a first-strike target) is the user's. Measure first which change raised the bursts
  2.6 × (more wars, more warheads, or the rule), then put the choice to the user in an ADR. AT: the cause
  measured on the critic's seeds; on 10 unseen seeds × 30 years bursts a world and civilian bursts (over
  10 × men) not above `dd3b730`'s on the same seeds, or the user's ADR accepting the measured volume;
  the gate green.

- [ ] 7.5 Run the critic (`CRITIC_PROMPT.md`), fix blocking issues, repeat until the DONE condition.
  AT: `critic/CRITIC_REPORT.json` for HEAD: parity dims ≥ 7, differentiators ≥ 8, zero blocking.

---

## Cross-reference: PROMPT.md requirement → SPEC § / PLAN task

| Requirement | SPEC | PLAN |
|---|---|---|
| AI free-for-all: expand, war, peace, ally, unions (unity), puppets (autonomy), revolt, collapse | §3.5, §4, §7 | 1.16–1.20, 1.24 |
| Cores, revolts per province/region, revival (finite, cooldown), suppression, winner-takes-all, occupation layers | §4 | 1.15, 1.19, 1.20 |
| Sue for peace when broke/exhausted, fight to the death, aggression/traits, income bonus | §3.4, §7 | 1.9, 1.16, 1.24 |
| Economy tick | §3.7, §7 | 1.9, 1.10, 1.26 |
| Terrain types, cities/capitals | §3.2, §3.3 | 1.2, 1.5, 1.11 |
| Major Battles, efficiency modes, buffs | §5.3, §5.4, §3.5 | 1.21–1.23 |
| Long-run dynamism | §7, §10 | 1.40, 7.3 |
| God Mode (all tools) | §9 | 1.32, 1.33, 6.1 |
| Editor (paint, undo, mask, cities, costs, alliances, puppets, annex, revolts, import, flags, files) | §9, §2.7 | 1.35–1.38 |
| Map modes | §9 | 1.30 |
| Stats + history log (filter, export) | §9 | 1.34 |
| QoL (pan/zoom/touch, speeds, autosave, screenshot, UI size, i18n, looping, map sizes, unit size, polish) | §9, §8 | 0.17, 0.21, 1.27–1.31, 1.39 |
| Seeded deterministic runs, randomisation | §2.6, §9 | 0.10–0.13, 1.39 |
| 1938 scenario, data-driven | §3, §2.7 | 1.1–1.7 |
| Semantic zoom (4 tiers, one truth, no popping) | §8, §3.6 | 0.14–0.17, 2.1–2.10 |
| Naval | §6.2 | 4.1–4.7 |
| Armour | §6.1 | 3.1–3.6 |
| Aircraft | §6.3 | 5.1–5.7 |
| AI nukes | §6.4 | 6.1–6.8 |
| Worker sim, fixed timestep, spatial index, perf budget, bit-identical save, tooling | §2, §8, §10 | 0.2–0.4, 0.12–0.13, 1.27, 7.1 |
| Iteration files (PROGRESS, BLOCKERS, DECISIONS, DATA_SOURCES, PARITY, parity script) | — | 0.5, 0.7, 0.8 |
| Soak, sweep, scripted demos, critic | §10 | 2.10, 3.6, 4.7, 5.7, 6.7, 7.2–7.5 |

## Done: the first lines

Not read at the start of an iteration. The gate and `npm run critic:due` read these ticks; the text of each task is in `docs/PLAN_DONE.md`. Written by `npm run plan:archive`: do not edit.

- [x] 0.1 git repo + `.gitignore` (reference/, .cache/, build outputs). […]
- [x] 0.2 Vite + TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) + Preact; `npm run dev/build/preview`. […]
- [x] 0.3 ESLint flat config incl. sim purity rules (§2.1 SPEC) and module-boundary rule (local `warsim/module-boundaries`, see ADR-12). […]
- [x] 0.4 vitest + Playwright installed; `npm test`, `npm run e2e`, `npm run check` (= tsc + eslint + vitest + build + parity). […]
- [x] 0.5 Iteration docs: PROGRESS.md, BLOCKERS.md, DATA_SOURCES.md (stub entries), note in PROGRESS that `reference/NOTES.md` is missing. […]
- [x] 0.6 Extract trailer frames: `ffmpeg -i reference/video/*.mp4 -vf fps=0.5 reference/frames/%04d.png` (+ scene-change frames `scene_%03d.png`, since the only clip is 42 s); view a sample and record observations. […]
- [x] 0.7 Fetch itch page, devlog index + all posts, Steam page; write `docs/PARITY.md` Table 1 (numbered AoC rows, TEXT/VISUAL source, all `not started`) + Table 2 (our additions). […]
- [x] 0.8 `npm run parity` (tools/parity): parse the tables, compute the score, check evidence paths for `verified` rows, compare against the header score. […]
- [x] 0.9 `sim/core/dmath`: sin, cos, atan2, exp, log, pow via tables + polynomials. […]
- [x] 0.10 `sim/core/rng` (PCG32 + streams) and `hash32/xxhash32`. […]
- [x] 0.11 `sim/core/tables`: SoA growable tables with free lists, id-ordered iteration, serialize/deserialize to sections, `stateHash()`. […]
- [x] 0.12 Toy world + tick loop (grid 256×128, two nations, random-walk formations) running in Node and in the worker. […]
- [x] 0.13 Worker protocol: commands, subscribe, rAF-acked snapshots, buffer pool, coalescing of dirty tiles + event ring cursor. […]
- [x] 0.14 Render benchmark A: raw WebGL2 (twgl) id-map renderer with smooth-border shader at 2048×1024, 150 nations. […]
- [x] 0.15 Render benchmark B: instanced proxies with GPU interpolation, 10k / 30k sprites; same scene in PixiJS v8. […]
- [x] 0.16 Camera-relative precision test at close zoom (1 m/px) at lon 179°. […]
- [x] 0.17 Camera controller: wheel/drag/keyboard/touch pinch, continuous z, looping-x wrap rendering. […]
- [x] 0.18 Data pipeline v0 (`tools/data`): download NE 10m land, admin-0, admin-1, populated places, marine polys, and ETOPO into `.cache/`; produce the fine land mask, elevation pyramid and `manifest.json` with sha256; DATA_SOURCES updated. […]
- [x] 0.19 Load-time vector rasterizer (admin-1 → province raster) at S/M sizes in the worker. […]
- [x] 0.20 Headless runner `npm run sim` (Node) with per-year metrics JSON. […]
- [x] 0.21 i18n skeleton: `t()`, `en.json`, locale picker, ESLint no-literal-string on `src/ui`. […]
- [x] 0.22 Phase 0 review: re-read SPEC for drift, update DECISIONS with the benchmark outcomes. […]
- [x] 1.1 zod schemas for terrain, unit types, tech, traits, buildings, scenario, map meta; validate all `data/**`. […]
- [x] 1.2 Terrain derivation (elevation + latitude/biome from NE raster) → terrain classes; CROSSING lanes data (straits list). […]
- [x] 1.3 1938 ownership: admin-1 → nation table + split polylines for interwar borders; colonies; mandates. […]
- [x] 1.4 Nations data (≥ 100 incl. colonies/dominions as puppets): colours, names, traits, aggression, cores, capitals, alliances (Axis-precursor, Allied guarantees, Comintern), puppets. […]
- [x] 1.5 Cities (NE populated places, filtered and named) with capitals. […]
- [x] 1.6 Flags: SVG flag spec + preset renderer; 1938 flags for all nations (own designs); flag atlas generation. […]
- [x] 1.7 Starting OOB per nation (formations of unit templates at historical-ish locations, scaled). […]
- [x] 1.8 Calendar/time (1938-01-01, hourly ticks), scheduler (speed, pause, max). […]
- [x] 1.9a Boot the 1938 scenario as sim state (split out of 1.9: the economy needs the real world): cells incl. province layer, nations, cities, OOB formations; worker loads the map assets; `?scenario=1938` in the app. […]
- [x] 1.9 Economy: per-cell income weight × terrain × development, monthly tick, gold, expenses (upkeep, admin cost superlinear), incomeBonus −100..100, bankruptcy. […]
- [x] 1.10 Production & recruitment queue; manpower. […]
- [x] 1.11 Land movement: coarse nav graph (province adjacency + CROSSING) + cell-level A*, mobility × terrain costs, slotted poses. […]
- [x] 1.12 Supply v1: from capital/cities through the controlled network; attrition when cut. […]
- [x] 1.13 Engagement + element combat v1 (§5.2) for inf/art/AT/AA. […]
- [x] 1.14 Territory pressure + frontier-set flips + connectivity rule. […]
- [x] 1.15 Occupation vs owner, capital capture/relocation, winner-takes-all option. […]
- [x] 1.16 Wars: declaration, war score, exhaustion, peace settlement, broke/exhausted sue for peace, fightToDeath. […]
- [x] 1.17 Alliances/unions with unity & loyalty; join/leave/dissolve. […]
- [x] 1.18 Puppets with autonomy: create/release/integrate/revolt. […]
- [x] 1.19 Revolts (per province/per region setting), suppression spending, rebel nation spawn. […]
- [x] 1.20 Collapse & revival (finite, cooldown) from cores. […]
- [x] 1.21 Buffs/debuffs with timers. […]
- [x] 1.22 Combat-efficiency modes (dynamic/progressive/static/locked/random). […]
- [x] 1.23 Major Battles + breakthrough corridor. […]
- [x] 1.24 Strategic AI v1 (war/peace/alliance/puppets/coalitions), traits/aggression. […]
- [x] 1.25 Operational AI v1 (front allocation, offensives, reserves). […]
- [x] 1.26 Economic AI v1 (budget split, build mix). […]
- [x] 1.27 Save/load full state + command log, gzip; autosave to IndexedDB. […]
- [x] 1.28a T0 renderer: borders without artefacts (analytic border gradient), occupation hatch, […]
- [x] 1.28b T0 renderer: coastline from the fine land-mask pyramid; terrain map mode. […]
- [x] 1.29 Curved nation labels (worker derive + MSDF). […]
- [x] 1.30a Map modes political, terrain, wars, diplomacy, alliances, puppets, income + legends, […]
- [x] 1.30b Revolts map mode (per-province unrest choropleth: province raster + unrest texture). […]
- [x] 1.31a Nation panel (Overview and Economy tabs; chips select nations); worker `nationStats`. […]
- [x] 1.31b Statistics ranking (right panel, metric dropdown) and war banners strip. […]
- [x] 1.32a God Mode commands in SPEC §9 (rename, war, peace, alliance, collapse, spawn […]
- [x] 1.32b God Mode UI: a God panel (bottom bar toggle) issuing those commands on the selected […]
- [x] 1.33a Take control of a nation; select own formations; move/attack orders by map clicks. […]
- [x] 1.33b Player Actions tab for the controlled nation: diplomacy (declare war, offer peace, […]
- [x] 1.34a History log (saved), History panel with filters + CSV/JSON export. […]
- [x] 1.34b Statistics: per-nation series (land, income, gold, military size by domain, […]
- [x] 1.35 Editor: brush/bucket/line, undo/redo, target mask. […]
- [x] 1.36 Editor: cities, gold & core costs, alliances, puppets, annex, preset revolts. […]
- [x] 1.37a Editor: map import (image → terrain/owner palette mapping). (Split from 1.37, 2026-10-03.) […]
- [x] 1.37b Flag editor with presets. […]
- [x] 1.38 Scenario files save/load (shareable `.warsim-scenario`). […]
- [x] 1.39a Settings panel: UI size, unit size, screenshot key (F2), seed + new game; speed/pause […]
- [x] 1.39b1 New-game options: looping map, randomisation (aggression, traits, starting gold, […]
- [x] 1.40 Dynamism tuning: `npm run sweep` (10 seeds × 50 years) passes the SPEC §10 criteria. […]
- [x] 1.41 Phase 1 review + PARITY rows updated with evidence. […]
- [x] 1.42a Tick time back under control before the next full sweep (ADR-48). Profile of year 1, […]
- [x] 1.42b Critic B1: coalition armies fight on their partners' fronts (ADR-50). Seed 109 […]
- [x] 1.42c Critic B1: the build queue of a rich nation at war no longer waits for months for a […]
- [x] 1.42d Critic B1: land is measured by true area, not by cell count (ADR-52; the user's […]
- [x] 1.42d2 Critic B1: the monthly statistics series records land in km² (the land chart). […]
- [x] 1.42f Tick time is over budget again after ADR-50 and ADR-51: seed 99 × 5 years, mean […]
- [x] 1.42e Critic B1: sim rules that count land in cells count area instead (overextension […]
- [x] 1.42e1 The land rules of a war count km² (ADR-57): score, true share, capitulation, puppet […]
- [x] 1.42e2 Overextension counts km²: a holder's share of the world's owned land […]
- [x] 1.42e3 The admin cost counts km² held (`economy.ts`): `adminCost` per 212,000 km² (1,000 […]
- [x] 1.43a Critic B5: a way into the game. `/` opens a title screen, not the two-nation toy […]
- [x] 1.43b The title screen loads a game: Continue (the autosave, with the seed and options of […]
- [x] 1.43c The title screen shows the chosen scenario: a political map of its start and its […]
- [x] 1.44 Critic B6: the editor's brush and line paint on a left-drag. While a paint tool is […]
- [x] 1.44b The God Mode territory brush paints on a left-drag too (it is click-only, and a […]
- [x] 1.45a Critic B7, the ghost counters: no half-faded unit layer is left standing. (1.45 was […]
- [x] 1.45b Critic B7, the wall of counters: Europe readable at world zoom. T0 counters are […]
- [x] 1.45c Capital flags do not hide unit counters. The flags are drawn above the unit layers […]
- [x] 2.1 T1 operational markers (symbol, flag chip, strength bar + number, order arrows, battle markers). […]
- [x] 2.2 T0 aggregated counters with stable multi-level clustering + split/merge animation. […]
- [x] 2.3 Element snapshot path (interest-managed) + GPU-interpolated element sprites at T2 (facing, walk/drive anim). […]
- [x] 2.4a FireEvent visuals: tracers, muzzle flashes, impacts (ADR-66; first answer to critic B2). […]
- [x] 2.4b Casualty removal and wrecks (ADR-67; split from 2.4, as it needs an event of its own): an […]
- [x] 2.5 Casualty consistency across tiers (ADR-68: `spawnFormation` takes a template, so that […]
- [x] 2.6 T3 close expansion (vehicles exact, infantry ≤ 64 sprites, count = strength). […]
- [x] 2.7a Slots stay: an element keeps its place in its formation's block when others die (ADR-70; split […]
- [x] 2.7b Fade curves & hysteresis for all layers: T1 ↔ T2 and T2 ↔ T3 are states with hysteresis and a […]
- [x] 2.7c The marker → elements morph: the box shrinks into the group and fades, the strength bar lingers (ADR-72). […]
- [x] 2.7d The layers that are not units (ADR-73): the capital flags switch at 3 px per cell in one frame, and the […]
- [x] 2.7e The curved nation names (ADR-73, addendum): a name appears in one frame when its size reaches 9 px or a […]
- [x] 2.7f The counters' cluster level comes to rest (ADR-74, finding 1). `CounterLayer.layout` judges the […]
- [x] 2.7g A destroyed nation's capital flag goes with it (ADR-74, finding 2). The view only ever adds to […]
- [x] 2.7h The sprites keep their clock when a snapshot repeats a tick (ADR-74, finding 3). A new subscription […]
- [x] 2.7i Sprites and figures wear the nation's own colour in every map mode, as the markers and counters do […]
- [x] 2.7j Figures that fade out are of the snapshot in hand (ADR-74, finding 5). Leaving T3, a tick that […]
- [x] 2.7k A nation's name keeps its state when the camera crosses the seam of a looping map (ADR-74, finding 6). […]
- [x] 2.7l What the counters show at rest does not depend on the frames drawn on the way there. Seen […]
- [x] 2.7m The view draws again after a frame that started an animation, however late the next frame […]
- [x] 2.7n At the closest zooms the figures of a formation are there wherever the camera looks at it […]
- [x] 2.7o A formation that takes the id of one destroyed in the same step does not arrive from where […]
- [x] 2.7p A pan at T3 from empty ground onto a formation shows its figures, not its T2 sprites first […]
- [x] 2.7q A world loaded into a running game takes the place of everything of the old one in the view […]
- [x] 2.7r City names stay readable among the T0 counters and the capital flags. The counters are drawn […]
- [x] 2.7s T1 markers of a dense group do not stand on each other. Seen in PLAN 1.45a and left without a […]
- [x] 2.7t A city's name is readable where a nation's name crosses it. The curved nation names are drawn […]
- [x] 2.7v The T1 markers come to rest (ADR-74, third read, finding 1; a defect of PLAN 2.7s2). `nudgeApart` […]
- [x] 2.7w A marker that goes into a stack fades where it stands (ADR-74, third read, finding 3; a defect of […]
- [x] 2.7x A table loaded larger than it was still tells its rows apart (ADR-74, third read, finding 2; a […]
- [x] 2.7y Decide what a pause in mid-tick does to the sprites, and make it so (ADR-74, third read, […]
- [x] 2.7u City names keep clear of the T1 markers, as they do of the T0 counters (PLAN 2.7r left it; it […]
- [x] 2.7z On the way back from T2 the T1 markers stand where they will rest (ADR-74, fourth read, finding 1). […]
- [x] 2.8 Procedural detail tiles (ground texture, trees, rocks, buildings near cities) by world-seeded noise, plus hillshade from the elevation pyramid. […]
- [x] 2.9 Coastline from the fine mask at T2/T3; elements never rendered on water. […]
- [x] 2.10 Scripted seamless zoom demo (world → close on an active battle), 8 stops, screenshots. […]
- [x] 2.11 Phase 2 review: re-read SPEC for drift, PARITY rows updated with evidence, and the […]
- [x] 2.12 Critic R2-B4 (report of 2026-10-05 on `3d6a2b2`): a loaded game goes on as the game […]
- [x] 2.13 Critic R2-B3, the first part: the 1938 order of battle is still there after the […]
- [x] 2.14 Critic R2-B2: the close zoom shows a battle, and says who is in it. The […]
- [x] 2.15 Critic R2-B6, the part that is not balance: a nation's end does not found dozens of […]
- [x] 2.16 Critic R2-B7: more than one way to start. The title screen lists "World, 1938" and […]
- [x] 2.16R Review pass (PROMPT step 9) over PLAN 2.12 to 2.16: refactor debt, dead code, […]
- [x] 2.17 Critic R2-B8: a God Mode action does what it says, or says why not. Seen through […]
- [x] 3.1 Armour unit types L/M/H + mech/mot, tech generations, production cost/time, upkeep. […]
- [x] 3.2 Fuel/supply consumption and breakdown effects. […]
- [x] 3.3 Terrain modifiers for tracked mobility and combat. […]
- [x] 3.4 Combined arms (inf + art + armour bonus; AT vs armour; armour vs infantry in the open). […]
- [x] 3.4R Review pass (PROMPT step 9) over PLAN 2.17 and 3.1 to 3.4: refactor debt, dead […]
- [x] 3.5 AI uses armour as spearheads; the economic AI adapts the mix. […]
- [x] 3.6 Tank visuals: sprites, turret facing, muzzle flash, burning wrecks at T2/T3. […]
- [x] 3.7 Phase 3 review: re-read SPEC for drift, PARITY rows updated with evidence, and the […]
- [x] 3.8 Critic R3-B4 (report of 2026-10-07 on `a6f63ef`): no war inside one realm or one […]
- [x] 3.9 *Done 2026-10-07 (ADR-186):* a revolting region is at most `REGION_KM2` = […]
- [x] 3.10 *Done 2026-10-08 (the AT of five years holds; the critic's years 8 and 9 of seed […]
- [x] 3.11 *Done 2026-10-08 (its parts 3.11a to 3.11f, ADR-198 to ADR-207; the AT on seed […]
- [x] 3.12 Critic R3-B6: a watcher is told what happens as it happens, and the history can […]
- [x] 3.12R Review pass (PROMPT step 9) over PLAN 3.8 to 3.12, the five numbered tasks since […]
- [x] 4.1 Sea zones (Voronoi + named seas) + lane graph + straits/crossings; ports & naval bases. […]
- [x] 4.2 Fleets & ship element types (DD, CL, CA, BB, CV, SS, TP) + movement along lanes. […]
- [x] 4.3 Detection + fleet battles at ship-element level (gunnery ranges, torpedoes, screening). […]
- [x] 4.4 Sea control per zone; sea supply; convoys; blockade; submarine raiding. […]
- [x] 4.5 Amphibious invasion (embark, escort, land, penalties, bombardment). […]
- [x] 4.6 Naval AI (sea control, escort, raiding, invasion planning). […]
- [x] 4.7 Naval visuals: ship sprites, wakes, gunfire, torpedo tracks, sinking; sea-control map mode. […]
- [x] 4.8 Phase 4 review, the phase's one review pass (PROMPT step 9, ADR-266): refactor debt, dead code […]
- [x] 4.9 Critic R4-B2 (report of 2026-10-12 on `5e91a56`): a player can invade, and a refused […]
- [x] 4.10 Critic R4-B4: naval warfare can be seen. Seen by the critic: at T0 a fleet's counter […]
- [x] 4.11 Critic R4-B6: the ranking's rows hold their names and values. From row 11 down a […]
- [x] 5.1 Air wings, airbases, carriers, range; air zones. […]
- [x] 5.2 Mission scheduler + sorties as derived kinematics. […]
- [x] 5.3 Air combat, interception, AA; air superiority per zone. […]
- [x] 5.4 CAS + tactical bombing effects on ground battles; naval strike; carrier air groups in fleet battles. […]
- [x] 5.5 Strategic bombing of industry, ports and cities (income/production damage, repair). […]
- [x] 5.6 Air AI tasking. […]
- [x] 5.7 Air visuals: planes along sortie paths, dogfight tracers, flak, bomb impacts; air superiority map mode. […]
- [x] 5.8 Phase 5 review, the phase's one review pass (PROMPT step 9, ADR-266): refactor debt, dead code […]
- [x] 4.12 Critic R5-B4 (report of 2026-10-14 on `c850346`): a sea battle shows both sides. The […]
- [x] 5.9 Critic R5-B1 (report of 2026-10-14 on `c850346`), first of three: the air war seen at […]
- [x] 5.10 Critic R5-B1, second: the air-superiority mode is read. On day 20 of a war it shows 2 […]
- [x] 5.11 Critic R5-B1, third: the air war in what is read afterwards. No air event reaches the […]
- [x] 5.12 Critic R5-B2: the AI's air war keeps flying. Seed 7321: mean sorties aloft 19.1 in […]
- [x] 6.1 Nuclear tech chain, warhead production, stockpile, upkeep; global and per-nation toggles. […]
- [x] 6.2 Delivery: bombers (interceptable) and missiles (later tech). […]
- [x] 6.3 Blast + fallout (deterministic wind drift, decay) on cells, elements, cities. […]
- [x] 6.4 Nuclear decision utility (target value, desperation, retaliation incl. allies, taboo, MAD, doctrine). […]
- [x] 6.5 Consequences: relations, alliance unity, outrage, economic shock, peace/retaliation responses. […]
- [x] 6.6 Nuke FX at every tier (flash, shockwave, mushroom cloud, fallout overlay), alert banner, auto-pause option, go-to button. […]
- [x] 6.7 Scripted AI nuclear strike demo (seeded scenario where the AI *decides* to strike, not God Mode). […]
- [x] 6.8 Multi-decade sweep with nukes on: no runaway extinction; MAD dynamics observed. […]
- [x] 6.9 Phase 6 review, the phase's one review pass (PROMPT step 9, ADR-266): refactor debt, dead code […]
- [x] 6.10 Critic R6-B1 (report of 2026-10-15 on `228d083`): the nuclear years make the game crawl. […]
- [x] 6.11 Critic R6-B2 (report of 2026-10-15 on `228d083`), first of two: where the AI's warheads […]
- [x] 6.12 Critic R6-B2, second: who strikes whom. The first use in history is the Soviet Union […]
- [x] 7.1 Performance pass against all budgets (T0 60 fps, T2 30 fps @10k, tick ≤ 1.5 ms). […]
- [x] 7.1b Map sizes S–XL (ADR-43): convert the audited cell constants to km (identical at M, […]
- [x] 1.42 **Moved here from Phase 1 on 2026-10-03 (ADR-58, the user's decision): balance is […]
- [x] 7.2 30-minute soak with save/load twin comparison. […]
- [x] 7.3 Final multi-decade sweep (≥ 10 seeds) — borders moving, no hegemon. […]
- [x] 7.4 Visual polish vs reference (borders, labels, UI frames, flags, fonts). […]
- [x] 7.6 Critic R7-B1 (report of 2026-10-17 on `19e2341`): AI nuclear use too rare to be seen, […]
- [x] 7.7 Critic R7-B2 (report of 2026-10-17 on `19e2341`): late-game stalls in the invasion AI. […]
- [x] 7.8 The air zone's holder is someone fighting there (aircraft 5, needs 8): on day 10 of […]
- [x] 7.9 Tanks read as armour at T3 (tanks 5, needs 8): at 10 m/px a tank is about 8 px, all one […]
- [x] 7.10 Ships look like ships, and a sea battle is seen (naval 5, needs 8): at 15 m/px ships are […]
- [x] 7.11 A fight at T3 reads as two sides with a line between them, and a struck city shows it […]
- [x] 7.12 The nuclear age in the statistics (stats 7): warheads, the nuclear dead and fallout in the […]
- [x] 7.13 The editor places warheads, fleets and wings, and asks before a chosen file starts […]
- [x] 7.14 Long wars with no land front end in a peace, and the late game has new causes of war […]
- [x] 7.15 The late world keeps moving (dynamics 6): seed 3371 moves 0.72 % of its land in years 26 […]
- [x] 7.16 God Mode and the UI's small things (God Mode 7, UI 7): a nuke's size (thermonuclear) in […]
- [x] 7.17 A smaller save (stability 7): 39.4 to 40.0 MB at year 12 to 27 […]
- [x] 7.18 AI nuclear use seen and credible (critic R8-B1, run 8 on `fd27e85`): 8 of 17 unaided 30-year […]
- [x] 7.19 A sea battle's ticker row lands on the fight (critic R8-B2, contradicts 7.10b): seed 5591, […]
- [x] 7.20 A hydrogen bomb is a hydrogen bomb (critic R8-B3, contradicts 7.16a): it kills 3 to 11 % more […]
- [x] 7.21 Infantry and the middle tier read at zoom (semantic zoom 7, needs 8): at 10 m/px infantry […]
- [x] 7.22 A sea battle seen firing, and fleets that hold their place (naval 6, needs 8): beyond […]
- [x] 7.23 A watched armour fight leaves burning hulls (tanks 7, needs 8): in 45 s at Speed x1 at […]
- [x] 7.24 Aircraft seen at every tier (aircraft 6, needs 8): at 900 m/px 0 to 1 sorties drawn, at […]
- [x] 7.25 AI nuclear use believed (AI nuclear use 6, needs 8): beyond 7.18's frequency, a world's […]
- [x] 7.26 The air war keeps flying after year 1 (aircraft 6, needs 8; the user's decision of […]
- [x] 7.27 No stasis on 8 of 10 unseen seeds (the sweep of 7.18g, `docs/sweeps/2026-10-18-sweep-718g.md`): […]
- [x] 7.28 A launch shot down and the gap after it (found 2026-10-18 by PLAN 7.26b, ADR-508): the […]
- [x] 7.31 Phantom sea battles (critic R9-B1, contradicts 7.19a): a battle in which no weapon can […]
- [x] 7.32 AI nuclear strikes on empty ground, in weekly chains, told by civilian dead alone (critic […]
- [x] 7.33 The history reads as events (stats and history 6, needs 7): beyond 7.31's phantom rows, […]
- [x] 7.34 Semantic zoom's seams (semantic zoom 7, needs 8): one wheel notch between 412 and 264 m/px […]
- [x] 7.30 The operational AI's late calls (from PLAN 7.27d, `docs/evidence/7.27/measure-d.md` §1): […]
- [x] 7.35 The war at sea seen and fought (naval 6, needs 8): beyond 7.31, the war at sea mostly […]
- [x] 7.36 Aircraft seen up close and the air map read (aircraft 6, needs 8): 0 sorties drawn at 25 […]
- [x] 7.37 AI nuclear use believed, beyond the chains (AI nuclear use 7, needs 8): single bombs on […]
- [x] 7.44 The yield chosen by the strike's utility, the dead's cost in it (from PLAN 7.38e, ADR-568's […]
- [x] 7.38 R10-B1: the AI's nuclear choice weighs the people a burst kills (AI nuclear use 7, needs […]
- [x] 7.45 The dead's cost at a high doctrine in extreme desperation (from PLAN 7.38e; AI nuclear use […]
- [x] 7.42 A block held back stands within contact reach of its enemy's block on every front (from […]
- [x] 7.29 The late land war's reach (from PLAN 7.26c3, ADR-519, 2026-10-18): after year 1 the land […]
- [x] 7.47 A navy rebuilt to a ship or two saves for the next at war with a naval enemy (from PLAN […]
- [x] 7.48 The critic's overrun France strikes before it loses its last bomber, with the chase (AI […]
- [x] 7.39 R10-B2: the war at sea goes on after year 1 (naval 6, needs 8; blocking). Year 1 a mean […]
- [x] 7.43 A cell taken goes to the side's nation whose own formations press it (from PLAN 7.37g): […]
- [x] 7.40 Emergent world dynamics (emergent 6, needs 7): stasis inside 30 years on the critic's […]
- [x] 7.46 A navy sunk in a decisive war at sea is built again (from PLAN 7.39b, ADR-573): with the […]
- [x] 7.53 Wars between peers (ADR-585, the user's decision, 2026-10-21: options 2 and 4 of the […]
- [x] 7.55 A transport group with room under a division's (found at 7.49f, emergent 6, […]
- [x] 7.50 The H-bomb at the floor on a city of a million, and the spot struck again (R11-B2): seed […]
- [x] 7.41 The war at sea seen (naval 7, needs 8, beyond 7.39; moved before 7.5 by ADR-577): the […]
- [x] 7.57 A carrier's strike sinks nothing (found at 7.41, naval 7, `docs/evidence/7.41/a.md` […]
- [x] 7.61 A land-based wing's strike sinks a whole fleet at once (found at 7.60, naval 7, […]
- [x] 7.58 The editor's fleet laid up at the month start (found at 7.41b, editor 7, […]
- [x] 7.59 Two placed navies out of sight never meet (found at 7.41c, editor 7, naval 7, […]
- [x] 7.52 AI nuclear use (aiNukes 7, needs 8, beyond R11-B2): the restraint line names a deterrent […]
- [x] 7.54 The landing's send ends at the first refused march (found at 7.49f, emergent 6, […]
- [x] 7.56 The landing's army marches over desert to its port (found at 7.54b, emergent 6, […]
- [x] 7.60 A carrier's strike sinks a whole fleet at once (found at 7.57, naval 7, […]
- [x] 7.49 The land war after year 1 (R11-B1; carries emergent 6, needs 7, ADR-583): engaged land […]
- [x] 7.65 The reserve cut (7.49e1, moved at 7.49's budget; ADR-592 a, the user's; carries emergent 6 […]
- [x] 7.63 The ferry's port nearest the front (found at 7.49d1, `docs/evidence/7.49/d1.md` §3; carries […]
- [x] 7.64 The ferry for a nation fronted through an ally alone (found at 7.49d2, […]
- [x] 7.66 Transports bought for a nation fronted through an ally alone (found at 7.64, […]
- [x] 7.68 A capital moves to the land its nation holds most of (the user's, 2026-10-21; found at […]
- [x] 7.67 New divisions of a nation fronted through an ally alone raised toward that front (the […]
- [x] 7.69 The AI's landing on a coast with no port: an enemy capital (the user's, 2026-10-21; found […]
- [x] 7.71 The landing takes a portless enemy capital before a nearer port (found at 7.69, […]
- [x] 7.72 The landing and the ferry board as a group (found at 7.70b, ADR-623): the first […]
- [x] 7.73 The Normandy without a loss of fight (7.70b's bar, ADR-623): with the rule, engaged land […]
- [x] 7.70 The AI's invasions open new fronts (the user's, 2026-10-21; a Normandy: a landing on […]
- [x] 7.62 An empty capital is no first-strike target (ADR-611 b, the user's decision, 2026-10-21; […]
- [x] 7.76 A capital taken counts in the desperation (found at 7.75; the user's decision, 2026-10-22; […]
- [x] 7.75 Supply over the beach on any land (ADR-622's scope b, the user's decision, 2026-10-22; […]
- [x] 7.77 The late land war under the air war (found at 7.51b; emergent 6, aircraft 7; R11-B1 as […]
- [x] 7.51 Aircraft (aircraft 7, needs 8, beyond 7.49): the late air war unchanged, 3,160 air […]
- [x] 7.74 An overrun holder's first strike is on the enemy overrunning it (found at 7.62; PLAN […]
- [x] 7.78 On a first strike a place's output counts only with an army in the blast (found at 7.74; […]
- [x] 7.81 Map visuals (mapVisuals 6, needs 7, beyond R12-B2): the map tooltip is stale, sixth run […]
- [x] 7.87 The far march to a threatened sector, over a season (found at 7.79d; R12-B1; waits on the […]
- [x] 7.88 The ferry's transport groups (found at 7.79c; R12-B1): `transportsAtPort` gives the ferry one group a […]
- [x] 7.89 The invasion turn held by one formation aboard (found at 7.88b; R12-B1): `invasionAi` skips a […]
- [x] 7.80 The late map shreds (R12-B2; carries map visuals 6): pieces of 2–400 cells of one holder at […]
- [x] 7.92 A far army of the enemy side weighed as the one overrunning the striker (found at 7.91, […]
- [x] 7.83 Performance (performance 6, needs 7): seed 99's mean tick 1.785–1.790 ms pinned on HEAD […]
