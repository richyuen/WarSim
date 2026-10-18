# WarSim — Phased Plan

Rules: each task is small and verifiable. `AT:` is the acceptance test that must
pass before ticking. Work top-down, and split a task if it grows past one iteration.
"Gate" = the full suite (tsc, eslint, vitest, build, parity) passes.
Balance sweeps are suspended until phases 2–6 are complete (ADR-58, PROMPT "KEEPING ITERATIONS
SHORT"): no sweep after a rule change. Each of those phases ends with a review that runs one
quick sweep as a smoke test.

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

Run 8's blocking issues and its dimensions under the DONE condition's bar (report of 2026-10-17 on
`fd27e85`, its "Fix" lines and evidence; R8-B1 to R8-B3 are PLAN 7.18 to 7.20, the dimensions 7.21
to 7.25; PROMPT 2a, ADR-486). A task each, split when taken up:

- [ ] 7.26 The air war keeps flying after year 1 (aircraft 6, needs 8; the user's decision of
  2026-10-17, ADR-487, reopening what ADR-377 accepted): on every one of 17 seeds 28 to 39 sorties
  aloft in year 1, then 0.5 to 14, while 1 to 14 wars run in every late year
  (`critic/c8_headless_*.json` `meanSortiesAloft`, `wars`). Measured first: a tool beside
  `tools/diag/` printing, per year, mean sorties aloft, wings of nations at war, how many have a
  mission, how many are out of range of every enemy land force, and land formations in contact;
  then the cause fixed (the air AI's tasking, the wings' bases, or the land war it follows).
  From 7.24a0 (2026-10-18): the loser's losses are bounded by its hours in combat, not by the fire
  (France 444 → 58 to 116 in three weeks at any `AIR_FIRE` from 0.03 to 0.25): a sortie that does
  not lose a quarter in an hour fights its whole patrol, a wing flies about 4.5 sorties a day
  (`TURNAROUND_HOURS` 2), every sortie within `INTERCEPT_KM` of the enemy's fights, and no wing is
  refilled. The levers left: those four. Year 1's sorties aloft rose with 7.24a0 (seed 6047's
  first three weeks: 25.7 → 34.6), and so does this AT's bar; measure on that rule. AT:
  10 seeds × 30 years headless: in each year with a war, mean sorties aloft at least half of that
  seed's year 1 on 8 of 10 seeds; the air battles of years 21 to 30 counted against years 1 to 10;
  the pin's entry if a rule moves it.
  A part each (2026-10-18):
    - [x] 7.26a The measure: `tools/diag/airWar.ts` (per year: sorties aloft as the critic counts
      them, wings, of nations at war, with a mission, out of range of every enemy land formation and
      why, hollow wings, formations in contact). AT: seeds 2843 and 7919 × 6 years measured
      (`docs/evidence/7.26/measure-a.md`): from year 2, 32 to 79 wings at war out of range; for 40
      to 76 % of them a base of their side with room is in range of some enemy, but `toward` aims at
      the enemy formation nearest the base, out of every such base's range for 64 to 93 %.
    - [x] 7.26b The rebase aims at an enemy it can reach: `toward`'s goal, the enemy formation
      nearest the base among those within range of an airbase of the side with room for the wing.
      AT: a unit test (a wing whose nearest enemy is beyond every base of its side rebases toward
      one it can reach and is tasked); `airToward1938` green; seeds 2843 and 7919 re-measured; the
      pin's entry if it moves. Done (ADR-508): from one state of day 900, seed 2843's missions a day
      25.5 → 30.9, seed 7919's unchanged.
    - [ ] 7.26c The land war that leaves the wings no enemy in reach. A probe at day 900 of seed
      2843 (after 7.26b's measure): of 143 wings, 81 at war with no mission, most with no airbase of
      their side in range of any enemy at all (Germany and Italy at war with France's African
      remnants after France fell; Japan with Indochina; Australia, South Africa, India with Germany);
      10 rebased in 10 days. Formations in contact fall 30 → 1–6 after year 1 while 4–8 wars run.
      Measured first, no code: from `critic/c8_headless_*.json`, land fire (`StrikeHit`,
      `FormationDestroyed`, `MajorBattleStarted`) by year beside `wars`; for each late war of seed
      2843 (`npm run diag`, `tools/diag/warFronts.ts`, `warGates.ts`): a land front between its
      sides or not, days since contact, its score, what keeps its peace unsigned (a war with no front
      ends after 365 days, ADR-480: whether that holds), and why the invasion AI lands no army on
      the remnants. Then one cause a commit, each measured with `airWar.ts` (a column of wings that
      rebased added). AT: the 7.26 AT's measure after the last; defensive patrols over home only if
      the years with a front still fall short.
      A part each (2026-10-18, from c0):
      - [x] 7.26c0 The measure: `tools/diag/landWar.ts` (per war, daily: frontless, a front and
        contact, a front and none; weekly the nearest pair of its sides' land formations; how it
        ended; the invasion AI's gate per nation at war), `tools/diag/armies.ts` (land formations,
        men, pools; the economic AI's gate for an army order each month), `airWar.ts`'s `rebased`.
        AT: seeds 2843 and 7919 × 8 years and the critic's files (`docs/evidence/7.26/measure-c.md`):
        frontless 0–31 % of war-days (ADR-480 holds); from year 2, 76–97 % of the days of wars with
        a front have no contact; in 39–45 % of the small wars' samples one side has no land
        formation and its land is hardly taken (Yemen and Saudi Arabia 720 days at 0); the blocs'
        armies stand a median 1,000 km and more apart, 47–84 % of them moving; the army halves in
        year 1 and holds; under 5 % of nation-days could land at all.
      - [ ] 7.26c1 The blocs' armies go where the enemy's are: in the big wars (a side of 50 or more
        land formations) the nearest pair stands over 1,000 km apart in 20–41 % of samples and
        47–61 % of the formations are moving. Measured first: where the moving formations of the
        big sides march to (the sector, its threat, km to go, days on the march, re-plans), from a
        checkpoint. Taken first: the idle wings are the great powers' of these wars (`airWar.ts`
        `out.byNation`: Germany, Italy, Japan, the Soviet Union). AT: `landWar.ts`: the big wars'
        contact share of front days (wars with a weekly sample of a side of 50 or more land
        formations: their `contact` ÷ (`contact` + `noContact`), added to the tool's yearly row,
        measured before on the same code) up from year 2; `airWar.ts`'s sorties; the pin's entry.
        Measured (2026-10-18, `tools/diag/marches.ts`, `docs/evidence/7.26/measure-c1.md`): the
        share before, years 1–8, 0.40/0.27/0.07/0.01/0.04/0.28/0.06/0.11 (2843) and
        0.48/0.16/0.10/0.05/0.14/0.17/0.06/0.06 (7919). In years 2–5 both sides keep 58–84 % of
        their men beyond `DEPLOY_RANGE_CELLS` of the war's front; 1–10 % of the enemy's stand within
        1.5 sectors of it; 95 % of the marches go to sectors with no enemy. A weight on the enemy's
        men within 30 cells moved nothing (2.6 → 2.4 %, 19.6 → 19.3 %; dropped). Beyond the range,
        17–32 % of each side's men are of nations with no front cell of their own in the war,
        standing: the marches from afar and to spare serve only the planner's own front.
        - [x] 7.26c1a A partner's garrisons go to its partners' front: a nation at war with no
          front cell of its own against an enemy sends formations that stand beyond the range to the
          empty sectors of its partners' front (the marches from afar, ADR-190, for a partner's
          sectors). AT: a unit test (a nation with no front of its own, its army idle beyond range
          of its ally's front, sets out; the ally's own marches unchanged); from the day-900 states
          (180 days, `.cache/tmp/abc.ts`) and one of day 400: the big wars' contact share, sorties
          aloft; `landWar.ts` 8 years; the pin's entry. Done (ADR-509): the share, years 2–8 of
          `landWar.ts`, mean 0.12 → 0.19 (2843) and 0.11 → 0.19 (7919); from the states 2.7 → 3.3,
          35.1 → 37.6, 19.6 → 21.4, 12.2 → 11.9 %; sorties aloft 16.9 → 19.7 and 14.1 → 14.0.
        - [x] 7.26c1b The own front's far marches, one a sector a week (9–21 % of the men standing
          beyond the range): only if c1a leaves the share short.
          After c1a (2026-10-18, `measure-c1.md` §5): partners' standing garrisons beyond the range
          31 → 9 % and 22 → 8 % of the big side's men, the own front's 16 %; the contact share rose
          less, the enemy seldom being on the front. Taken next: c2 (the empty land); c1b after it,
          and only if the 7.26 AT is still short.
          After 7.26d (2026-10-18): the AT is short; c1b is taken after c3 and c4.
          Done (ADR-513, `measure-c1.md` §6): the probe found "one a sector" was not the cause. Of an
          own-front planner's far men, 40 % cannot reach their empty sectors (the sea, closed
          ground), 33 % have none (front manned and strong where the enemy is not), 11 % have a
          partner's: now sent there when no own one is reached. From six states contact neutral
          (within a point), 130 partner marches in 180 days; 8-year runs 0.078 → 0.096 and 0.153 →
          0.125; pin bc1316df.
      - [ ] 7.26c2 Land that nobody holds is taken: a side at war whose enemy has no land formation
        on their front takes its cells. Measured first, from a checkpoint of seed 2843 with Yemen and
        Saudi Arabia at war (day 2136 on) and seed 7919's Iraq and Saudi Arabia (day 647 on): the
        operational AI's sectors of the side with the army there, their threat and orders, why its
        formations do not walk in. AT: a unit test (a nation at war with an enemy with no army
        beside it takes cells within N days); `landWar.ts` re-run: those wars end on a score, not
        the stalemate; the pin's entry if it moves.
        Measured (2026-10-18, `docs/evidence/7.26/measure-c2.md`): the plan's two wars are gone
        since c1a; seed 7919's Brazil v Paraguay (720 days at 0) stands in. Brazil's formations of
        130 to 707 men stand at Paraguay's cells and never take one (pressure under `GARRISON`),
        and they man the sectors its 12,460-man division beyond the range could reach, so the
        marches from afar never send it. Iraq v Saudi Arabia (2843) lost its front to a third
        party's conquest; #112 v Saudi Arabia (7919) never had one (c3's).
        A part each:
        - [x] 7.26c2a A formation too small to take a cell (`takeMen`) does not man a sector for the
          marches from afar. AT: a unit test (a full division beyond the range is sent past sectors
          held by formations of a few hundred men, and takes a cell); from one state each (365
          days, `.cache/tmp/abOne.ts`), the one-sided wars' scores; `landWar.ts` 8 years; the pin's
          entry. Done (ADR-510): from seed 7919's day 1312, Brazil v Paraguay 0 → 35, no other war
          worse from four states; pin 59fea6f5.
        - [x] 7.26c2b A nation whose whole army is under `takeMen` takes nothing (seed 2843's Brazil
          v Bolivia after c2a, 177 days at 0: formations of 38 to 2,617 men, one of 612 resting on
          its own land 170 days and not refilled). Measured first: in `landWar.ts`'s one-sided wars
          at a score under 15, the armed side's largest formation and its refills (ADR-435: why a
          formation at rest is not refilled, the pool, the gold). Then the cause fixed, only if the
          7.26 AT is still short. AT: the measure in `measure-c2.md`; a unit test of the rule; the
          pin's entry.
          Measured (2026-10-18, `measure-c2.md` §7): Brazil spent its army on British Guiana (the
          2,617-man division encircled, starved at supply 0); of what was left, 612 men at rest and
          38 at Bolivia's border were refilled by no man in six months, and no division ordered:
          ADR-437's keep (a division's 1,001 gold over a reserve of 343 to 360, against 1,094 to
          1,262, about 28 a month saved). Bulgaria v Romania the same gate, but it takes cells. The
          rule is as decided; the change (refills at war not held for the next order) waits on
          7.26d. Taken next: 7.26d.
          After 7.26d (2026-10-18): the fix is last, after c3, c4 and c1b.
          Done (ADR-514, `measure-c2.md` §8): at war the refills take what is over the reserve,
          the next order's price not kept. Brazil v Bolivia from day 1655, both rules on this code:
          score 0 → 17 in 170 days; from six states contact 11.4 → 10.9 %, spawned 250 → 249,
          sorties 17.4 → 17.9; 8-year runs' contact 0.096 → 0.055 and 0.125 → 0.080; pin e1856b1b.
      - [ ] 7.26c3 The landing per war, not per nation: a nation with a land front in one war plans
        no landing in its others (30–50 % of nation-days), and colonies have no transports. Only if
        c1 and c2 leave the 7.26 AT short. AT: `landWar.ts`'s gate counts; the pin's entry.
        Taken next (7.26d, 2026-10-18): 59 % of the short years' out-of-range wings have no base
        of their side in range of any enemy, the overseas powers' first.
        A part each (2026-10-18):
        - [x] 7.26c3a The landing per war: a nation with a front in one war may land in a war in
          which it has none. Measured first, no rule changed: `landWar.ts`, for each fronted
          nation-day, the gate it would meet per war (`perWar`) and per enemy (`perEnemy`), and the
          nations that would load or send. Then the rule, only if `perWar` reaches `atPort` or
          `send` on enough nation-days to matter. AT: the measure in
          `docs/evidence/7.26/measure-c3.md`; a unit test (a nation fronted in one war lands in its
          other; with the one war only, none); `landWar.ts`'s gates and `airWar.ts` re-run; the
          pin's entry. Done (ADR-511): per war, with the formations beyond the range of the own
          front on their land; from nine states embarks 25 → 29; `airWar.ts` 8 years, years 2–8
          sorties aloft 16.7 → 18.2 and 13.2 → 15.0; the big wars' contact share fell on both
          seeds' 8-year runs (0.164 → 0.131, 0.158 → 0.084), not on the states but one; pin
          5274b933.
        - [ ] 7.26c3b The colonies' and small members' landings (no transport group at a port of
          their own: 60–90 % of the unfronted nation-days). Measured first: whether a partner's
          transports could carry them. Only if c3a leaves the AT short.
          After c3a (2026-10-18): waits on 7.26e; c4 is next (7.26d's order).
          After 7.26e (2026-10-18): taken after 7.26f; 63 % of the short years' out-of-range wings
          have no base of their side near any enemy (the US, Japan, Germany, the Netherlands).
          From c1b (2026-10-18, `measure-c1.md` §6): 40 % of the far men of planners with a front of
          their own stand for want of a way to it (16 % across the sea: Japan, Britain, France; 24 %
          on their landmass behind closed ground or the sea: Italy to Africa, the Soviet Union, the
          Raj). A lift by sea to the own front, not only a landing on the enemy, would serve them.
      - [x] 7.26c4 The rebase over more than one hop: in 7.26d's short war-years 36 % of the wings
        out of range have a base of their side with room within range of an enemy, a tenth of
        them within one ferry hop (`freeInFerry`, 3 % of all out of range); 1.6 wings rebase a day of 54. Measured first: whether
        a wing whose goal base lies beyond `FERRY_RANGE` moves toward it day by day or stays, from a
        checkpoint. AT: a unit test (a wing two hops from a base in range of the enemy reaches it
        and is tasked); `airWar.ts` on seeds 2843 and 7919; the pin's entry if it moves.
        Done (ADR-512, `docs/evidence/7.26/measure-c4.md`): of 114 such wings on six states, 91 have
        no chain of the side's bases within ferry hops (the sea), 23 a chain of 2–5 hops, and 17 of
        those sat (no base within a hop nearer the goal). Now a wing on a chain hops to fewer hops
        left, or as many and nearer the goal. From the six states sorties aloft 17.19 → 17.33;
        `airWar.ts` 8 years 18.2 → 16.2 and 15.0 → 12.8 (one run each, diverging); pin 63d9b3b5.
    - [x] 7.26d The AT of 7.26 on 10 seeds × 30 years, after 7.26c; what is short split again.
      (2026-10-18: taken before the open c-parts, c1b, c2b's fix and c3, which wait on it.)
      Done (2026-10-18, `docs/evidence/7.26/measure-d.md`, `tools/diag/airAt.ts`): seeds 1–10 on
      `edd105e`: 0 of 10 pass, as before (the critic's run 8, 0 of 10). The late air war about
      doubled (years 2–10 mean aloft 5–11 → 13–20; air battles about 7 ×), but year 1 rose alike
      (29–39 → 39–52) and with it the bar; the late years hold 0.2–0.4 of year 1. In the 273 short
      war-years, 54 of 73 wings at war have no enemy land formation in range, and land formations in
      contact are 1.2 a day against 32 in year 1. Of those out of range: 59 % no base of their side
      in range of any enemy (the US, Japan, Germany, Italy, Britain first), 36 % such a base free,
      a tenth of them within one hop (3 % of all out of range). The order of what waits: c3, then c4 (new), then c1b, c2b's
      fix last; then 7.26e.
    - [x] 7.26e The AT of 7.26 re-measured (`airWar.ts` seeds 1–10 × 30 years, judged by
      `tools/diag/airAt.ts`) after the parts 7.26d ordered; what is short split again.
      To read against c3a (ADR-511): from the probes, every landing it added went through the
      `atPort` gate (Japan); its far marches to a port (`send`) were re-ordered or still on the
      way after 30 days, and the big wars' land contact fell on both 8-year runs. If the AT is
      still short and the contact down on more seeds, question the `send` path for a nation with
      a front first, not the per-war gate.
      To read against c4 (ADR-512): from six states neutral (sorties aloft 17.19 → 17.33), but both
      8-year runs fell (18.2 → 16.2, 15.0 → 12.8). If the ten seeds fall below 7.26d's, test first
      whether a wing on a chain should still take a base within a hop nearer its goal in km with more
      hops left (the old step took it; ADR-512 does not), then c3a.
      To read against c1b (ADR-513): neutral from six states; the 8-year runs went both ways (contact
      0.078 → 0.096 and 0.153 → 0.125, sorties aloft 16.2 → 17.5 and 12.8 → 16.6). If the AT is
      still short, c1b is not the first question: c3b's lift by sea to the own front is the larger
      share of the standing men.
      To read against c2b (ADR-514): neutral from six states (contact 11.4 → 10.9 %), but both
      8-year runs' contact fell (0.096 → 0.055, 0.125 → 0.080), and seed 7321's Soviet Union raised
      9 divisions in 10 years against 21, its surplus in refilled men's upkeep. If the ten seeds'
      contact falls below 7.26d's, test first the keep at war only while the order is within a few
      months of the treasury's growth (not the balance's: Brazil's gold grew 28 on +30 to +54).
      Done (2026-10-18, `docs/evidence/7.26/measure-e.md`): seeds 1–10 on `80bcc74`: 0 of 10 pass,
      as at 7.26d. Year 1 held (mean 48.7 → 47.4); the late air war fell (years 2–10 mean aloft
      15.8 → 14.9, years 21–30 9.8 → 7.3 on 8 of 10, their air battles 14,664 → 7,524), rebases up
      (1.6 → 2.0 a day) and missions down (11.8 → 10.5), while land contact held (years 2–30 1.42 →
      1.36 a day, 5 seeds up, 5 down). So c4's question is first; c2b's and c3a's are not taken
      (the contact did not fall). Of the short years' out-of-range wings 63 % have no base of their
      side near any enemy (59 % at 7.26d): c3b before anything of c1b's. Next: 7.26f, c3b, 7.26g.
    - [x] 7.26f Which of c3a, c4, c1b and c2b lowered the late air war (7.26e: years 21–30 sorties
      aloft 9.8 → 7.3 on 8 of 10 seeds while land contact held): each rule's old behaviour behind a
      switch for the runs only, and 30-year runs from 1938 with one switch off each (4 × seeds 1, 5
      and 7, the largest falls: 12 runs side by side, about 15 minutes), judged by `airAt.ts` and
      `.cache/tmp/cmp726e.ts` against `.cache/726e/`. Not from saved states first: c4, c1b and
      c2b each read neutral from six saved states while the long runs fell (the effect builds from
      year 1). c4's switch also tries the old step's variant (a wing on a chain takes a base within
      a hop nearer its goal in km with more hops left). Sorties aloft, missions, rebases. AT: the rule found restored or changed in its own commit, with a unit test; the
      A/B's figures in `docs/evidence/7.26/measure-f.md`; the pin's entry if it moves. If no rule
      of the four accounts for it, the late years' cause measured again and split.
      Done (ADR-515, `docs/evidence/7.26/measure-f.md`): c4 (ADR-512). With it off, years 21–30
      sorties aloft up on 8 of 10 seeds, level on 2, down on none (7.24 → 9.52; 7.26d 9.8), air
      battles 7,524 → 10,207; c1b off up 6, down 4. The switches checked first: all off gave
      7.26d's hashes, all on 7.26e's. ADR-512 taken back (the old step); pin c9f5962b.
    - [ ] 7.26g The AT of 7.26 re-measured (as 7.26e, seeds 1–10 × 30 years) after 7.26f and
      c3b; what is short split again.
- [ ] 7.27 No stasis on 8 of 10 unseen seeds (the sweep of 7.18g, `docs/sweeps/2026-10-18-sweep-718g.md`):
  on seeds 701–710 × 50 years the same five largest nations for 22, 20 and 20 years running on 702,
  704 and 706 (7 of 10; seeds 1–10 at `714`: 9 of 10). Measured first: in those runs, which five
  hold, from which year, and what wars they are in (`npm run diag -- --load` from a checkpoint of
  the year the run begins); then the cause fixed. AT: no stasis on 8 of 10 seeds of a sweep on
  unseen seeds, the other criteria held; the pin's entry if a rule moves it.
  Measured (2026-10-18, the sweep of 7.24a on seeds 721–730 × 50 years, `docs/sweeps/2026-10-18-sweep-724a.md`):
  no stasis on 10 of 10 (the longest one top five 7 to 19 years), every other criterion held. The
  air's calibration and spread (ADR-502, ADR-503) came between; whether they or luck did it is this
  task's to find (a second sweep on other unseen seeds, then the measure above if it fails).
- [ ] 7.28 A launch shot down and the gap after it (found 2026-10-18 by PLAN 7.26b, ADR-508): the
  critic's France (`nukeOverrun1938`, seed 7127) launches once on day 71, the warhead is shot down
  by German fighters, STRIKE_GAP_DAYS (ADR-507, keyed on the launch) holds its next attempt, and
  its one strategic wing is lost on day 73 on a strike: 9 warheads never used. ADR-491 promised a
  holder under enemy air launches again the next day. Measured first: `nukeGates.ts`'s `paused`
  split by whether the launch that began the gap burst or was stopped short, seeds 1–10 × 30
  years. Then the rule decided (a launch stopped short starts no gap, or a shorter one) and
  recorded. AT: the measure in `docs/evidence/7.28/`; a unit test of the rule chosen; the pin's
  entry if it moves.
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
