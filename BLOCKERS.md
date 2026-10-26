# BLOCKERS

Tasks that failed 3 attempts or cannot proceed, with what was tried. Resolved
entries are kept and marked **RESOLVED** with the date and fix.

## Open

### PLAN 7.116b's AT missed: engaged a war late 0.111 → 0.113 of year 1's, bar 0.15 (ADR-702; waits on the user)
- **The bar:** on 10 unseen seeds × 20 years against HEAD read first on the same seeds, engaged land formations a war,
  years 2–20, at least 0.15 of year 1's; a unit test, red without; the gate green.
- **What moved** (`docs/evidence/7.116b/measure.md`, `at.md`, `rule.patch`; 1001–1010): an attack marches on the enemy
  formation in reach in no battle; HEAD 0.111, the rule 0.113 (5 of 10 up); contact a world-year +5 %, the share of
  the army at war in contact +10 %, wars +11 %, formations destroyed +14 % a year, the army at war a war −13 %; year 1
  −7 %. The unit case red on HEAD, green with the rule.
- **What is left:** the user's (ADR-702): (a) no rule, PLAN 7.123 (why the rule raises wars and losses on fresh
  worlds); (b) commit the rule; (c) re-scope the bar to the share of the army at war in contact; (d) no rule, no task,
  to the next critic report (recommended).

### RESOLVED 2026-10-25 (option a, the user's decision: the rule committed, 7.116a closed not done, PLAN 7.122 dropped) · PLAN 7.116a's AT missed: hollow divisions 685 → 1, but engaged a war 0.874 × HEAD's, bar 0.95 (ADR-701)
- **The bar:** on 10 unseen seeds × 20 years against HEAD, land formations under 500 men at year 20 at most 0.5 ×
  HEAD's, engaged land formations a war (years 2–20) not below 0.95 × HEAD's; a unit test, red without; the gate green.
- **What moved** (`docs/evidence/7.116a/at.md`, `rule.patch`; 991–1000): hollow 685 → 1 (met); engaged a war 0.644 →
  0.562 (missed); land formations −11 %, engaged −5 %, wars +8 % a world-year; the unit cases red without the hook.
- **What is left:** the user's (ADR-701): (a) commit the rule, close it (recommended); (b) no rule, PLAN 7.122 for a
  fold that keeps the counter; (c) close it, no rule.

### RESOLVED 2026-10-25 (option a, the user's decision: the rule committed, 7.114 closed not done, no task) · PLAN 7.114's AT missed by one burst: all bursts killing over ten times more civilians than men 32 → 25, bar 24 (ADR-697; waits on the user)
- **The bar:** on 10 unseen seeds × 30 years against HEAD, strikes back killing over ten times more civilians than men
  at most 0.25 × HEAD's, all bursts so at most 0.75 × HEAD's; a unit test, red without; the gate green.
- **What moved** (`docs/evidence/7.114/at.md`, `rule.patch`; 981–990): strikes back so 8 → 0 (met); all bursts so
  32 → 25 (missed by one); the unit cases red on HEAD, green with the rule; the gate green, the pin unchanged.
- **What is left:** the 25 are first strikes. The user's (ADR-697): (a) commit the rule, close it (recommended); (b)
  as (a), and a task for first strikes; (c) close it, no rule.

### RESOLVED 2026-10-25 (option a, the user's decision: 7.112 closed not done, no rule, the probe kept, no task) · PLAN 7.112's AT missed: own walks 141,368 cells a tick, bar 3,567 (ADR-696; waits on the user)
- **The bar** (ADR-680 b): on year 21 of 4877 from `critic/c13_seed4877_y20.bin`, `pocketOf`'s cells walked a tick
  at most 0.5 × HEAD's (7,134); engaged land formations a war not below HEAD's (0.2647); the round trip's test green;
  a unit test, red without; the pin moved once; the gate green.
- **What moved** (`docs/evidence/7.112/measure.md`, `rule.patch`): each start's own walk, kept across ticks: 141,368
  cells a tick, engaged 0.2528, 86 s a year against 35. The keep is exact (the same hash with and without it).
- **What is left:** nothing of this rule; the user's (ADR-696): (a) close it, the probe kept (recommended); (b) a
  task for an answer shared by region; (c) the operational AI's cadence (ADR-680 c).

### RESOLVED 2026-10-24 (option a, the user's decision: 7.111 closed not done, the cuts kept, no task) · PLAN 7.111's AT missed: year 21 of 4877 at 4.24 and 4.22 ms a tick, bar 4.12 (ADR-695; waits on the user)
- **The bar** (ADR-694): year 21 from `critic/c13_seed4877_y20.bin`, `npm run sim -- --affinity 0xFFFF`, at most 4.12
  ms a tick, twice; the hash dba7fdae and the pin unchanged; the gate green.
- **What moved** (`docs/evidence/7.111/measure.md`): three exact cuts committed, HEAD 4.457 / 4.431 → 4.242 / 4.220;
  the hash and the pin unchanged; the gate green on each.
- **What is left:** `sectorShape`'s inner loop and sort (~0.08), the pockets (PLAN 7.112, a rule), the operational
  AI's cadence (~1.0, against R13-B1). The user's (ADR-695): (a) close it, the cuts kept (recommended); (b) as (a),
  and 7.112 read on the late tick too.

### RESOLVED 2026-10-24 (option b, the user's decision: the strike rule alone, coverage read as the mean of days 10–30, 7.115 closed not done) · PLAN 7.115's AT missed: land formations at war a war 56.77 (bar: not below the strike rule's 62.54), engaged 0.664 (bar 0.671) (ADR-693; waits on the user)
- **The bar:** with 7.110b's strike rule and the spread, `operationalAi` green; Poland's day-30 coverage at least 0.6;
  on 971–980 × 20, land formations of nations at war a war in years 2–20 not below 62.54 and engaged a war not below
  0.671; a unit test, red without; the gate green.
- **What moved** (`docs/evidence/7.115/at.md`): the spread (a class's threatened sectors one each, the most threatened
  first, before a second) puts Poland at 0.870 on day 30, both nations over 0.6 on every day of 10–30; `operationalAi`
  green; its unit case red on HEAD, green with it; the gate green on the patch. The army at war 56.77 (HEAD 51.38,
  strike alone 62.54), engaged 0.664 (0.497, 0.671). Not committed (`rule.patch`); the pin unchanged.
- **What is left:** the spread takes part of what the strike rule kept off the main fight; HEAD's own coverage is under
  0.6 on days 16, 17 and 29; the retreat piles one battle's formations on one cell (`retreat.ts`, untouched); the patch
  loosens `nukeAlertStop1938`'s gap 24 → 48 hours. The user's (ADR-693): (a) neither rule, a task to measure the
  spread's cost; (b) the strike rule alone, coverage read as the mean of days 10–30 (recommended); (c) both rules.

### RESOLVED 2026-10-24 (option b, the user's decision: 7.110b closed not done, PLAN 7.115, the rule committed with it) · PLAN 7.110b's AT missed: land formations at war a war 51.38 → 62.54 (× 1.217, bar × 1.3) (ADR-692; waits on the user)
- **The bar:** on 971–980 × 20 against HEAD on them, land formations of nations at war a war in years 2–20 at least
  1.3 × HEAD's; engaged per war there not below HEAD's; a unit test, red without; the gate green.
- **What moved** (`docs/evidence/7.110b/at.md`): the rule (`rule.patch`: a strike puts a quarter of its fire on a land
  formation out of contact, PLAN 7.110a's lever) × 1.217 the army (up on 8 of 10), × 1.35 engaged per war (met). Its
  unit case red on HEAD, green with it. Not committed; the pin unchanged.
- **What is left:** two history tests red with it: `operationalAi` (Poland's day-30 front coverage 0.519, bar 0.6,
  HEAD 0.607: the operational AI piles the formations the strikes no longer kill) and `wholeTanks` (division 41's
  first fight later and lighter). The user's (ADR-692): (a) commit, the two tests restated (`wholeTanks` from the first heavy fight: 6 tanks lost on
  HEAD, 1 with the rule), no task; (b) PLAN 7.115
  for the spread of a larger army, the rule committed with it (recommended); (c) no rule, no task.

### RESOLVED 2026-10-24 (option a, the user's decision: the rule committed, 7.109b closed not done, PLAN 7.114) · PLAN 7.109b's AT missed: bursts killing over ten times more civilians than men 36 → 34 (0.94 ×, bar 0.75 ×) (ADR-691; waits on the user)
- **The bar:** on 10 unseen seeds × 30 years, bursts killing over ten times more civilians than men at most 0.75 ×
  HEAD's on the same seeds; a unit test, red without; the gate green.
- **What moved** (`docs/evidence/7.109b/at.md`; 961–970): the rule tried (`rule.patch`: a grievance remembers a
  strike on forces, and its answer weighs the places with an army in the blast first, a city only when none of them
  is over its floor and in reach) takes the strikes back among those bursts 17 → 14, all 36 → 34; bursts 278 → 277.
  Not committed; the pin unchanged. Its unit test is red on HEAD and green with it.
- **What is left:** 19 of HEAD's 36 are first strikes, out of the answer's reach. Of the answers, the places of
  forces are worth the warhead but out of the answerer's range while a city is in it (964: 65 days at ~0.68, none in
  reach; 86,000 civilians, no men), and a city with a hundredth of the theatre's men counts as forces (968: 96,000
  civilians, no men). The user's (ADR-691): (a) commit the rule, 7.109b closed not done, PLAN 7.114 for the answer
  weighed by its own toll (recommended); (b) 7.109b closed not done, no rule, 7.114 on HEAD; (c) commit the rule,
  close 7.109b not done, no task.

### RESOLVED 2026-10-24 (the user's decisions: the rebuild to the start's wings, ADR-689; 7.113a done on paired reads) · PLAN 7.113a's AT missed twice: engaged per war 0.598 → 0.395 (0.1) and 0.369 (0.035) with wings 2.3–2.4 × (ADR-687, ADR-688, 2026-10-24)
- **The bar:** on 951–960 × 20 against HEAD, wings of living nations in years 2–20 at least 1.25 × HEAD's; engaged
  per war there not below HEAD's; a unit test, red without.
- **What moved** (`docs/evidence/7.113/at.md`): the user's rule (ADR-686: the air force under 0.1 of income, wings
  side by side) took wings 90.8 → 218.3 (met) and air battles 171.0 → 292.7, and engaged per war 0.598 → 0.395
  (missed, lower on 9 of 10). Not committed (`income.patch`); the pin unchanged.
- **What is left:** the share's size: at 0.1 of income the air force costs ~6 × the 1938 world's share, from the
  army's money. The user's (ADR-687): (a) 0.035 and the AT again (chosen): wings 210.0, engaged per war 0.369, the
  land war better in years 2–3 and worse from year 4 as the air forces grow past 1938's. ADR-688: (a) a ceiling at
  the 1938 share of income, 0.016 (recommended); (b) the income share at war only; (c) commit 0.035; (d) close.

### RESOLVED 2026-10-24 (option b, the user's decision: 7.108b closed not done; PLAN 7.113) · PLAN 7.108b's AT missed: late air battles 176.2 → 174.5 a world-year (0.99 ×, bar 1.25 ×) (ADR-685, 2026-10-24)
- **The bar:** on 10 unseen seeds × 20 years against HEAD on them, air battles a world-year after year 1 at least
  1.25 × HEAD's; a unit test, red without; the gate green.
- **What moved** (`docs/evidence/7.108b/read.md`, `at.md`; 931–940): late, most idle fighters at war whose enemy
  has air sit with a base of their side in reach of the enemy across the sea and no chain of ferry flights to
  it (872 of 872 reads). The rule tried (`rule.patch`: such a fighter crosses to that base) lifts battles × 3.7
  over 90 days from run 13's saves, but from 1938 the late battles were 174.5 against HEAD's 176.2: the wings
  late fall 87.9 → 68.9 a world (+15 % battles in years 2–7, −16 % and −27 % after). Not committed; the pin
  unchanged (c848f884).
- **What is left:** the air force at war late: HEAD's wings 168.6 a world in year 1, 87.9 after; the crossers
  are spent within 90 days of crossing and not replaced (in their fights or with borrowed bases that fall: not
  read). The user's (ADR-685): (a) 7.108b closed not done, no rule; (b) closed not done and a numbered task for
  the air force at war late, the crossing re-measured on it (recommended); (c) the crossing committed as it stands.

### RESOLVED 2026-10-24 (option a, the user's decision: bar 1 re-scoped; read on ADR-682's code 2.75 → 6.34 and 3.45 late, bar 2.20; PLAN 7.107 done) · PLAN 7.107's AT: battles sinking nothing met (7.28 → 2.56 %), late sea battles missed (0.95 × HEAD, bar 1.3 ×) (ADR-683, 2026-10-24)
- **The bar:** on 10 unseen seeds × 20 years against HEAD on them, sea battles a world-year after year 1 at least
  1.3 × HEAD's, and battles sinking nothing at most 4 %; a unit test, red without.
- **What moved** (`docs/evidence/7.107/measure.md`, 921–930): every battle that sank nothing was a transport group
  hit in its first hour that broke off with its damage carried as a wound. ADR-682's rule (a fleet that breaks off
  leaves no wound carried: each holed ship lost or healed on a seeded roll) takes them to 2.56 % (met). Late sea
  battles 10.37 → 9.83 a world-year (0.95 ×): 6 % more ships sunk, 6 % fewer armed fleets late.
- **What is left:** the late fall is the navies' count, not their meeting. A fleet at war with a navy fights 2.9
  battles a fleet-year in year 1, 2.4 at year 11, 3.1 at year 21 (924's stranded fleets aside); such fleets are 14.0
  a world in year 1 and 2.8–4.6 late (the armed fleets halve, and the share of them at war with a navy halves).
  The user's (ADR-683): (a) bar 1 re-scoped to battles per armed fleet-year at war with a navy (recommended);
  (b) a numbered task for the navies' rebuild (reopens ADR-667 a); (c) a numbered task for the war choice of
  naval powers. The rule committed; the pin moved f9d18365 → c848f884.

### RESOLVED 2026-10-24 (option b, the user's decision: 7.105 closed not done, cut 1 kept; PLAN 7.111 and 7.112) · PLAN 7.105's AT missed: year 21 of 4877 at 4.22–4.26 ms a tick, bar 3.0 (ADR-680, 2026-10-24)
- **The bar:** year 21 of 4877 from critic run 13's year-20 save at most 3.0 ms a tick headless pinned on
  0xFFFF, twice; engaged per war not below HEAD's.
- **What moved** (`docs/evidence/7.105/measure.md`): HEAD 4.50; `joinWide`'s cells sorted by digits
  (`8dd20446`, the same answers, the pin unchanged) −0.17 paired; the AT read 4.224 and 4.256.
- **What is left:** the reach tests (`pocketOf` 0.48 ms, `joinWide` 0.44) of a world 4.3 × as churned as
  896ff77's. Sized: the exact remainder ~0.3 (to ~3.9, PLAN 7.111), the pockets as a rule ~0.2–0.3 (to
  ~3.6, PLAN 7.112), the operational AI's turn every other day ~1.0 (against R13-B1). The user's
  (ADR-680): (a) 7.111 alone; (b) 7.111 and 7.112 (recommended); (c) both and the cadence. No rule;
  the pin unchanged (f9d18365).

### RESOLVED 2026-10-24 (option a, the user's decision: 7.104 closed not done; PLAN 7.110) · PLAN 7.104's AT missed: engaged per war late 0.112 of year 1 on HEAD, 0.104 with two rules, bar 0.15 (ADR-679, 2026-10-24)
- **The bar:** on 10 unseen seeds × 20 years against HEAD, engaged land formations a war in years 2–20 at
  least 0.15 of year 1's; formations under 500 men at year 20 not above HEAD's; a unit test, red without.
- **What moved** (`docs/evidence/7.104/measure.md`, 901–910): HEAD 0.112 (567 under 500 men); with both
  rules of `rule.patch` (a threatened sector faces the nearest enemy formation; one short of
  OFFENSIVE_RATIO × its threat draws from 60–180 cells) 0.104 (489). On run 13's year-20 saves the rules
  lift contact ×1.32 over 180 days; from the AT's year-10 checkpoints ×0.83.
- **What is left:** the army at war a war is a third of year 1's by year 20, and its share within 12
  cells of an enemy a third or less. The user's (ADR-679): (a) PLAN 7.110, the army at war's size
  (recommended); (b) PLAN 7.87 reopened instead; (c) neither, to the next critic report. The code
  restored; the pin unchanged (f9d18365).

### RESOLVED 2026-10-24 (critic run 13 ran on `0c80db1e` after `npm run check:review` green) · Critic run 13 waits on PLAN 7.102 and 7.103: two tests off the known-red list

- **What:** `npm run check:review` on `9ffb0274` listed `formationFight1938` and `tankBattle1938` as known red
  (`tools/gate/knownRed.json`: a software GPU in a cloud container). Here they fail on what they claim
  (a block 21.4 km from its foe, bar 20; a flash 0.278 of a figure from its tank, bar 0.3), and both were
  green here at `896ff779` (critic run 12's review). The list's own rule: a test leaves it when it passes
  here. Taken off; PLAN 7.102 and 7.103 hold them.
- **Tried:** formationFight's furthest block probed (Polish division 310, engaged with a move order held,
  as 160–190 others are on days 21–22: not a stuck march). tankBattle's measure read (to the nearest
  figure of the shooter's element, not the firing figure). Neither cause found yet.
- **2026-10-24:** 7.102 done (ADR-677: a file to the side over the sea; `formationFight1938` green alone).
- **2026-10-24:** 7.103 done (ADR-678: the flash measured from the tank that fired it; `tankBattle1938`
  green alone, 3.0 min).
- **Left:** `npm run check:review` again (the code key moved: from the start, alone on
  the machine), then the critic. Not verified: `zoomDemo1938`'s red here (a strength over 64 at its
  line 315) is a claim's too, not the GPU's; it was red here at `896ff779` as well.

### RESOLVED 2026-10-23 (option a, the user's decision: 7.101 closed not done, no rule) · PLAN 7.101: the scramble and the narrowed sweep, sweeps that fought 1.6–1.8 % against half (ADR-674)
- **The bar:** on 10 unseen seeds × 20 years late air battles at least a tenth of year 1's, at least half
  of the sweep sorties meeting a defender, engaged per war not under HEAD's.
- **What moved** (`docs/evidence/7.101/read.md`, 871–872): sweeps that fought 1.2/0.9 % → 1.6/1.8 %; late
  air battles pooled 0.074 → 0.098 with both rules (the scramble alone 0.074).
- **What is left:** the swept bases are empty (10 %, 76 %) or hold bombers (39 %, 19 %) when the sweep is
  over them; the user's (ADR-674): (a) close, no rule; (b) the first and third clauses on 891–900 with a
  HEAD control, commit if they hold (recommended); (c) a task for the sweep picked at launch. The code
  restored; the pin unchanged (7c2e4700).

### RESOLVED 2026-10-23 (option b, the user's decision: the HEAD control run; the stasis worse, the rule then committed by the user's override; 7.100 closed not done) · PLAN 7.100: the cadre division at war, battle share 1.85 % against 1.96 %, two stases over 15 years (ADR-673)
- **The bar:** on 10 unseen seeds × 30 years the front battle's share in years 10–30 at least 1.96 % pooled,
  no stasis over 15 years.
- **What moved** (`docs/evidence/7.100/at.md`, 861–870): with the rule (`rule.patch`) 1.85 % pooled; stasis
  864 22 years, 868 17 (Denmark at war, untouched). Same seeds from year 10: front battles ×1.3 and ×2.0.
- **What is left:** the user's (ADR-673): (a) commit the rule; (b) a HEAD control on 861–870 first, then
  commit or drop (recommended); (c) drop it. 7.100 closed not done in each. The code restored; the pin
  unchanged (7c2e4700).

### RESOLVED 2026-10-23 (option b, the user's decision: 7.99 closed not done, PLAN 7.101 for a defence that rises) · PLAN 7.99: the sweeps at the enemy's air meet nothing, battles late 0.074 → 0.082 on two seeds (ADR-672)
- **The bar:** on 10 unseen seeds × 20 years air battles a year in years 2–20 at least a tenth of year 1's.
- **What moved** (`docs/evidence/7.99/read.md`): the rule tried on 871–872 × 20 years against HEAD, 0.074 →
  0.082 pooled, sorties aloft late +40–55 %; of 120,472 sweep sorties in years 2–10, 1.0 % near any air
  battle. 82–90 % of idle wings at war have nothing of the enemy in range at all.
- **What is left:** the user's (ADR-672): (a) 7.99 closed not done; (b) closed not done, a numbered task
  for a defence that rises against a raid, the sweep kept to manned bases and fleets (recommended); (c) the
  rule as tried committed. No rule committed; the full AT not run on a rule that flies for the count.

### RESOLVED 2026-10-23 (option a, the user's decision: 7.79 closed not done, PLAN 7.97 for the American piles) · PLAN 7.79: the land war after year 1 on fresh worlds, engaged per war 0.074 of year 1's, 32 piles held 30 days (2026-10-23, ADR-661 proposed; the user's decision)
- **The bar:** on 10 unseen seeds × 20 years engaged land formations a war in years 2–20 at least a tenth
  of year 1's, and no pile of 30 or more of a nation at war on one cell for 30 days.
- **What moved** (`docs/evidence/7.79/at.md`, seeds 821–830, `landAt.ts`): against the tree before 7.79's
  first rule on the same seeds, late engaged per war 0.295 → 0.477, the ratio 0.055 → 0.074 (bar 0.1);
  piles held 30 days 29 → 32, 18 of them American (one cell on 5 seeds, up to 548 days).
- **What is left:** the user's (ADR-661): (a) 7.79 closed not done, PLAN 7.97 for the American piles
  (recommended, as ADR-653 a set for piles built from 1938); (b) 7.79 closed not done, judged by the next
  critic report; (c) the bar re-scoped to the
  rise, 7.79 ticked.

### PLAN 7.83c: supply's beach layer −7 %, short of `dd3b730` + 0.03 (2026-10-23)
- **The bar:** supply's mean a tick on a year from HEAD's year-4 save of seed 99 at most `dd3b730`'s rules'
  + 0.03 (0.168 ms; 0.153 against the pairs' own HEAD), the year's hash f278491d and the pin unchanged.
- **What moved** (`docs/evidence/7.83/c.md`): the beach layer an array by cell (`SparseLayer`), the flood's
  marks the layer itself; hash f278491d, random and toy worlds the same: 0.202 → 0.188 ms (three swapped
  pairs); refreshBeaches 558 → 389 ms a year profiled, the per-formation loop near `dd3b730`'s.
- **What is left:** about 0.04 ms a tick: the coast scan (27,619 coast cells asked their network each
  refresh, scattered over the grid; the network changed at all 240 refresh hours read, so last hour's
  candidates never hold), `seaWay` for the blocs `reach` did not search, the flood. Less needs the coast
  cells whose network changed kept by the network's refresh, a larger change than this part. No
  decision of the user's waits on it; the loop takes PLAN 7.83d, and 7.83's AT is read after it.

### PLAN 7.83b: the invasion AI's turn −33 %, short of half (2026-10-23)
- **The bar:** invasionAi's mean a tick on a year from HEAD's year-4 save of seed 99 at most half of
  HEAD's in the same swapped pairs (0.238 → 0.119 ms), the year's hash f278491d and the pin unchanged.
- **What moved** (`docs/evidence/7.83/b.md`): ten cuts that change no outcome (hash f278491d after each;
  seed 7 × 3 years the same): 0.238 → 0.160 ms (−32 % and −33 % by core), share of the tick 11.2 % →
  7.9 %, calls of 1 ms or more 340 → 270 a year.
- **What is left:** the rules' own work, about 0.05–0.06 ms a tick: the passage's reach walks the ferry's
  port pick needs (37 a year), the route searches bounded by FERRY_SEARCHES and SEND_SEARCHES, and
  `seaReach`, which supply reads after it in the hour. Less needs fewer searches a turn, a rule change.
  No decision of the user's waits on it; the loop takes PLAN 7.83c, and 7.83's AT is read after 7.83d.

### PLAN 7.89: a formation aboard holds no ferry turn now, but the lift is short of the army; piles 2 → 2 (2026-10-22, ADR-643)
- **The bar:** piles of 30 or more of a nation at war on one cell 30 days running on 1129 year 10, 6421
  year 20 and 7019 year 10 (`piles.ts --days 30`) 2 → 0; a unit test red without; the ADR; the pin.
- **What moved** (`docs/evidence/7.89/a.md`): the rule is in: the lock holds a landing and a Normandy only
  while a landing is at sea, never the ferry. The USA's ferry turns on 1129 1 → 4; ferry boardings in 30
  days 3 → 7 (1129), 3 → 78 (6421), 0 → 1 (7019); landings the same; a unit test red without; pin
  b7653c3c → 0b3aea1f. Piles 2 → 2: 1129's 53 fall to 41, its 60 by Chicago do not move.
- **What is left:** PLAN 7.90. The USA's 12 groups hold 288,000 men against about 1.35 million in the two
  piles; a round trip carries 4–8 divisions. No decision of the user's waits on it; the loop takes it after
  PLAN 7.80b.

### RESOLVED 2026-10-23 (option a, the user's decision: the flat 60 days, R7-B1's test restated; 7.96c and 7.96 done) · PLAN 7.96c: the volleys bar met only by holding R7-B1's fight-for-life France two months (2026-10-23, ADR-660 proposed; the user's decision)
- **The bar:** 7.96's (ADR-658 b): volleys (bursts by a striker within 30 days of its own last) and the
  civilian share not above `dd3b730`'s on 811–820 × 30 years (29 %, 32 %).
- **What moved** (`docs/evidence/7.96/c.md`, `c.patch`): a flat 60-day wait gives 5 % and 16 %, and turns
  `nukeStrikeAgain1938` (R7-B1) red; keeping the week for nations in extreme desperation gives 30 % and
  14 %, the test green. HEAD 31 %, 13 %.
- **What is left:** the user's (ADR-660): (a) the flat 60 days, R7-B1's test restated (recommended); (b)
  the week kept for the desperate, the bar missed by a point; (c) neither.

### RESOLVED 2026-10-23 (option b, the user's decision: 7.96's bar on volleys and the civilian share; PLAN 7.96c) · PLAN 7.96b: the taboo after a burst cuts bursts a fifth, the bar is a tenth; 7.96's bar is the user's (2026-10-23, ADR-658 proposed; the user's decision)
- **The bar:** 7.96's: on 10 unseen seeds × 30 years bursts a world and civilian bursts not above
  `dd3b730`'s (read on 811–819: 89 and 28; 820 not run).
- **What moved** (`docs/evidence/7.96/b.md`, four of 7.86's seeds × 30 years): TABOO_AFTER 0.6 bursts 122 →
  97, 0.7 101 (`dd3b730` 12); volleys within 30 days 42 → 27 and 31, not in order. Not run on the unseen
  seeds: 10 × short.
- **What is left:** the user's (ADR-658): (a) accept the volume; (b) re-scope the bar to volleys and
  civilian share, then PLAN 7.96c (recommended); (c) a restraint on desperation's strike.

### RESOLVED 2026-10-23 (option b, the user's decision: PLAN 7.96, the input that doubled the rate, then a rule on it; 7.86 closed into it) · PLAN 7.86: the AI's bursts ×2.5 follow the busier war; the nuclear rules since `dd3b730` are not the cause (2026-10-23, ADR-657 proposed; the user's decision)
- **The bar:** on 10 unseen seeds × 30 years, bursts a world and civilian bursts (over 10 × men) not above
  `dd3b730`'s on the same seeds, or the user's ADR accepting the measured volume.
- **What moved** (`docs/evidence/7.86/measure.md`, 12 of the critic's seeds × 30 years, three trees): the
  cause read. Bursts 85 → 190 → 213: warheads ×0.98, holder-days at war ×1.16, the nuclear rules since
  `dd3b730` ×1.12 (noise on 12 seeds), and ×1.93 the same old rule firing more often a holder-day at war
  in HEAD's world. Civilian bursts' share 31 % → 16 %, their count 26 → 34.
- **What is left:** the user's (ADR-657). (a) accept the volume; (b) PLAN 7.96, read which input of the
  decision moved, then a rule on it (recommended); (c) a world taboo rising with each burst.

### RESOLVED 2026-10-23 (ADR-651 a, the user's decision: the assertion widened, 7.91 committed from its patch; 7.90g next) · PLAN 7.91 (and 7.90g after it): held on `nukePoland1938` seed 5591, whose "on Germany" is the user's to keep or drop (2026-10-22, ADR-651 proposed; the user's decision)
- **The bar:** with 7.91's patch, `nukePoland1938` green on its three seeds with the first burst on
  Germany (PLAN 7.92's AT, first branch), so that 7.91 and then 7.90g can be committed.
- **What moved:** nothing; no rule written (PLAN 7.92, `docs/evidence/7.92/measure.md`). The Italian army
  Poland strikes with the patch faces France, Poland's ally in this same war, in a theatre of about
  half the enemy side: a fair target by the rules as written. HEAD's burst on Germany is a German city
  by its output (334,000 dead), decided on a day the city led the Italians by 0.006.
- **Decided** (2026-10-23, the user: ADR-651 a): the assertion widened, then 7.91 and 7.90g land from their
  patches; this entry is resolved by that commit.
- **What was left:** the user's (ADR-651). (a) replace the test's "on Germany" by "on Germany, or on a place of
  at least 50,000 enemy men", then 7.91 and 7.90g land from their patches; (b) a rule weighing the striker's own
  front first; (c) open. Meanwhile the loop takes PLAN 7.90h.

### RESOLVED 2026-10-23 (option b, the user's decision: PLAN 7.95, a warship's saving in a land war; 7.84's battles bar waits on it) · PLAN 7.84d: the navies not rebuilt after year 2 for ADR-615's war reserve; the fleets bar out of reach without the user (2026-10-23, ADR-656 proposed; the user's decision)
- **The bar:** on 7.84c's 10 seeds × 20 years (`seaYears.ts`), armed fleets in years 10–20 at least 0.9 of
  `dd3b730`'s (73.7; HEAD 51.3) and late sea battles not below its 13.43.
- **What moved** (`docs/evidence/7.84/d.md`, read on 3613 and 4219 × 10 years): the cause read. HEAD's
  depleted navies are stopped by gold, the treasury at 0.44–0.45 of the warship's line against 0.71–0.76,
  because the army's orders at war spend toward zero (ADR-615, `WAR_RESERVE_MONTHS` 0). With the reserve
  back at 3, fleets in years 2–10 are 26.7 → 40.8 and 45.9 → 52.1 (`dd3b730` 54.4, 62.5) and battles 7.9 →
  16.0 and 14.8 → 16.0 (12.8, 12.7). The fleet step keeping the war's reserve changes nothing.
- **What is left:** the user's (ADR-656). (a) accept, drop 7.84's battles bar; (b) PLAN 7.95, a warship's
  saving in a land war for a nation with no armed fleet and an army near its peacetime share
  (recommended, unmeasured); (c) undo ADR-615. The other half of the fleets' gap is losses in the busier
  world (7.79, 7.82).

### RESOLVED 2026-10-23 (option a, the user's decision: the budget's bar is the rules' cost on one world, +0.145 ms against +0.2, met; SPEC §8 says so; PLAN 7.94 taken) · PLAN 7.83: the tick 1.94–1.97 ms against 1.5; the busier world holds most of it (2026-10-23, ADR-654 proposed; the user's decision)
- **The bar:** `npm run sim -- --scenario 1938 --seed 99 --years 5 --affinity 0xFFFF`, mean tick ≤ 1.5 ms
  and year 1 ≤ 2.4 ms, twice; no outcome changed only to save time.
- **What moved** (7.83b–d, `docs/evidence/7.83/at.md`): the invasion AI −33 %, supply −7 %, capitals
  −63 %, all with hash f278491d. From 1938, paired against the code before them: 1.993 → 1.849 ms (−7 %).
  On one world, the new rules' extra cost went from +0.41 to +0.15 ms.
- **What is left:** read alone, 1.970 / 1.938 ms (year 1 2.57 / 2.53, which is machine drift: 2.36 / 2.39
  paired). `dd3b730`'s own rules cost 1.82 ms on HEAD's year-4 world. The busier world (the land war,
  1.5–2.7 × the cells flipped) holds about 0.6 ms, and the operational AI is its largest system (0.60
  ms). The user's decision (ADR-654): (a) a bar on the rules' cost on one world, plus PLAN 7.94
  (recommended); (b) a budget of 2.0 / 2.6 ms; (c) keep 1.5 and optimise the busier world's systems.

### RESOLVED 2026-10-23 (option a, the user's decision: 7.90's piles bar closed as missed; the piles judged from 1938 by 7.79's AT; 7.90 open only for 7.90g) · PLAN 7.90: the ferry carries the Baltimore pile off, but not within 30 days, and the 60 by Chicago do not move; piles 2 → 2 (2026-10-23, ADR-653 proposed; the user's decision)
- **The bar:** piles of 30 or more of a nation at war on one cell 30 days running on 1129 year 10, 6421
  year 20 and 7019 year 10 (`piles.ts --days 30`) 2 → 0.
- **What moved** (7.90b–h, `docs/evidence/7.90/at.md`): every group tried a turn, the way back, two
  divisions a trip, transports bought for the far army, the sail past cut-off remnants. The Baltimore
  pile 53 → 31 by day 30 (7.89: 41) and 7 by day 85; 6421 and 7019 none. With 7.90g's held patch the same.
- **What is left:** the 60 by Chicago (121 cells from a sea port, never the nearest to a group), and the
  Baltimore pile's one division over the bar on day 30. Both piles predate the rules that move them; no
  rule meets the bar from the save in 30 days. The user's (ADR-653): (a) judge piles from 1938 by 7.79's
  AT, (b) a staging march (PLAN 7.93), (c) more lift (PLAN 7.93). 7.90g still waits on ADR-651.

### RESOLVED 2026-10-22 (PLAN 7.89 took the lock off the ferry, ADR-643; what is left is PLAN 7.90) · PLAN 7.88b: every group carries now, but one formation aboard holds the nation's turn; piles 3 → 2 (2026-10-22, ADR-642)
- **The bar:** piles of 30 or more of a nation at war on one cell 30 days running on 1129 year 10, 6421
  year 20 and 7019 year 10 (`piles.ts --days 30`) 3 → 0; a unit test red without; the ADR; the pin.
- **What moved** (`docs/evidence/7.88/b.md`): the rule is in (the user's ADR-637 a): the first ferry
  turn's groups that gave an order 1 → 6 on 1129, 1 → 26 on 6421; 6421's pile of 75 cleared (it boarded at
  Norfolk after 23 days). Piles 3 → 2: 1129's 60 (by Chicago) and 49 stay.
- **What is left:** PLAN 7.89. The invasion AI skips a nation's whole turn while one of its formations is
  aboard (PLAN 4.6b): on 1129, 2 divisions aboard for 22 days skipped the USA's next three turns. No
  decision of the user's waits on it; the loop takes it next.

### RESOLVED 2026-10-22 (the user's decision: the bar is capital moves per capture at most 1.25, met at 1.20; 7.81b and 7.81 done) · PLAN 7.81b: the capital moves follow the captures, the reserve cut's war; three captures in 30 days are overruns (2026-10-22, ADR-640, ADR-641; waits on ADR-639, the user's decision)
- **The bar:** on 10 unseen seeds × 30 years capital moves a world not above `dd3b730`'s on the same seeds,
  and no capital captured three times in 30 days.
- **What moved** (`docs/evidence/7.81/b.md`): field capitals go far from the enemy (ADR-640) and lost
  capitals to the safest city (ADR-641). On 791–800: moves per capture 1.80 → 1.20, field moves 200.3 →
  117.6 a world, three captures in 30 days 112 → 82. Moves a world 392.8 → 450.6: captures are 218.8 →
  374.8, 1.71 × `dd3b730`'s.
- **What is left:** the volume of captures is the war the reserve cut brought (7.80a, ADR-639: the user's
  a, b or c). Three captures in 30 days are nations overrun with no safer city on their main land; none
  is a bar for a placement rule. Read again once ADR-639 is decided.

### RESOLVED 2026-10-22 (option a, the user's decision: PLAN 7.80b next; what it leaves over the bar is the cut's price) · PLAN 7.80: the late map's shreds are the reserve cut's war, a user's rule (2026-10-22, ADR-639 proposed; the user's decision)
- **The bar:** on 10 unseen seeds, pieces of 2–400 cells at year 20 not above `dd3b730`'s on the same
  seeds; founded statelets at year 20 not above `dd3b730`'s.
- **What moved:** nothing; no rule written (PLAN 7.80a, `docs/evidence/7.80/a.md`). Bisected at year 10:
  the step is `d15131c4`, PLAN 7.65's reserve cut (ADR-615, from the user's ADR-592 a), 755 → 865 on 8 of
  8 seeds. More land changes hands (1.51 × by year 20) and pieces per flip fell; 358 of run 12's 1,174
  small pieces at year 20 are enclaves at peace (229 on `dd3b730`).
- **What is left:** the user's (ADR-639). (a) PLAN 7.80b, the settlement's pockets go with the land round
  them (ceiling on run 12's saves 816 against 837); (b) accept the count as the cut's price; (c) undo the
  cut. Meanwhile the loop takes PLAN 7.81.

### RESOLVED 2026-10-22 (option a, the user's decision: PLAN 7.88b, every idle group carries) · PLAN 7.79c: the stranded army is the ferry's now, but its one transport group a turn cannot act; piles 3 → 3 (2026-10-22, ADR-636; ADR-637 proposed, the user's decision)
- **The bar:** piles of 30 or more of a nation at war on one cell 30 days running on 1129 year 10, 6421
  year 20 and 7019 year 10 (`piles.ts --days 30`) 3 → 0; a unit test red without; the ADR; the pin.
- **What moved:** the rule is in (ADR-636): free for the USA's ferry 20 → 157 and 16 → 210; a unit test
  red without; pin e6c74731 → e66bef2e. The piles 3 → 3 (`docs/evidence/7.79/c.md`).
- **What is left:** PLAN 7.88. (a) the turn's group (most room, lowest id) is one that cannot act, at
  Nuuk and at Port-of-Spain/Roseau, while 11 and 33 stand idle: the loop's next. (b) one group a turn
  carries two of 1129's 60 divisions: the user's (ADR-637: a, every idle group carries; b, one a turn;
  c, open).
- **2026-10-22, PLAN 7.88a done** (ADR-638): (a) fixed, the USA's ferry turns that give an order 0 of 4 →
  3 of 3 on both saves; the piles 3 → 3 still (`docs/evidence/7.88/a.md`). (b) waits on ADR-637.

### RESOLVED 2026-10-22 (option b, the user's decision: no rule; PLAN 7.87 dropped) · PLAN 7.79d: the far army is 80–170 days of march from the threatened sectors beyond the range; the 30-day bar out of reach (2026-10-22, ADR-635 proposed; the user's decision)
- **The bar:** on run 12's saves 1129, 2081 and 6421 year 20, the threatened sectors with a formation of
  the planner within the range after 30 days (`frontSpread.ts`, `inRangeThreatenedAPlan`) at least twice
  HEAD's (1.27, 1.62, 5.58); a unit test red without; the pin's entry.
- **What moved:** nothing; no rule written (`docs/evidence/7.79/d/measure.md`). The far formations that
  reach a threatened sector on their landmass (0.96, 0.15, 0.17 a far plan) stand 206–353 cells from the
  nearest, none within 110 (the range and a month's march at 1.4–2.1 cells a day). No share of the far
  army can raise the figure in 30 days.
- **What is left:** the user's (ADR-635). (a) PLAN 7.87, the rule judged over 180 days; (b) no rule, 7.87
  dropped, 7.79's AT judges after 7.79c; (c) open. Meanwhile the loop takes PLAN 7.79c (83–98 % of the
  far formations reach no threatened sector on their landmass: the ferry's).

### RESOLVED 2026-10-22 (option b, the user's decision: 7.74 closed not done; PLAN 7.78 dropped; industry stays a first-strike target) · PLAN 7.74: Poland's first strike is an empty Berlin by its output, not an army; the AT red on HEAD (2026-10-22, ADR-632 proposed; the user's decision)
- **The bar:** on `nukeCase.ts 9437 POL GER 10 65 bomber`, a first decision within 60 days within a
  blast's radius of a land formation of the other side of Poland's war; red with THEATRE_FLOOR
  reverted; no rule change.
- **What moved:** nothing (no rule change). The test (`docs/evidence/7.74/nukeOverrunAim1938.test.ts.txt`)
  is red on HEAD: the first decision, day 35, is Berlin by its output alone (output share 0.050, men
  share 0.0004, capital 0, u 0.028, 334,000 people), the nearest army 91 km off. The same with
  THEATRE_FLOOR 0 (the floor binds nothing here). PLAN 7.62's and 7.76's "a Soviet army" was the
  previous day's out-of-reach best place, printed by `pol.py`: 7.62's own bar was missed.
- **What is left:** the user's (ADR-632). (a, recommended) PLAN 7.78, a place's output on a first
  strike only with an army in the blast, its AT 7.74's test; 7.74 closed not done into it. (b) An
  empty city's industry stays a first-strike target; 7.74 closed not done. (c) Open. Meanwhile the
  loop has no task before PLAN 7.5.

### RESOLVED 2026-10-22 (option b, the user's decision: 7.51b and 7.51 closed not done; PLAN 7.77 dropped; the aircraft score waits for the next critic run) · PLAN 7.51b: the late air war measured; air battles in years 2–20 at 0.065 of year 1's, bar a tenth; the cause the late land war (2026-10-22; the user's decision)
- **The bar:** on PLAN 7.49's unseen seeds 7401–7410 × 20 years, air battles a year in years 2–20
  at least a tenth of year 1's, or this entry with the measured cause, the user's to accept.
- **What moved** (`docs/evidence/7.51/b.md`, `tools/diag/airLate.ts`, on `309f0d4e`): year 1
  31,097 air battles on the ten seeds, years 2–20 200.7 a seed a year: 0.065 (by seed 0.043–0.146;
  7405 and 7410 at a tenth). Run 11 read 0.038 on its 14 seeds. Sorties aloft 40–58 in year 1,
  10–14 after.
- **The cause, measured:** the air war follows the land war (ADR-377: a nation at war flies at
  the enemy's land forces in range). Over the 190 seed-years, air battles against land formations
  engaged r 0.45, against wars running 0.06; by quartile of engaged, 112 / 136 / 187 / 317 air
  battles a year. Engaged per war late is 0.057 of year 1's, the air 0.065 of its own. PLAN 7.26
  found the air AI tasks as much of what is in range late as early (ADR-519) and a patrol over home
  meets nothing (ADR-520).
- **What is left:** the user's. (a, recommended) 7.51b closed not done on this cause, and the
  late land war taken up again as PLAN 7.77 (its bar a tenth of year 1's, 7.49's was a quarter);
  (b) 7.51b closed not done, no land-war task: the aircraft score waits for the next critic run;
  (c) an air rule not tied to the land war (an air war over enemy airbases or fleets with no
  front: measured as meeting little in ADR-520), its own task. Meanwhile the loop takes PLAN 7.74.

### RESOLVED 2026-10-22 (option b, the user's decision: the rule in, the France test amended to what it makes; 7.62 ticked on its own case, its 30-year bars missed; PLAN 7.74 re-homes 7.18j's aim) · PLAN 7.62: the empty-capital rule silences the critic's France of R8-B1; `nukeOverrun1938.test.ts` red with it, so the rule waits in a patch (2026-10-22, ADR-629 proposed; the user's decision)
- **The bar:** the critic's Poland (`nukeCase.ts 9437 POL GER 10 65 bomber`) strikes no capital with
  men share under 0.01 in 60 days and still strikes within 60 days (R8-B1); seeds 781–790 × 30
  years: civilian bursts (over 10 × men) at most 13, strikes back unchanged; a unit test, red without;
  and the gate green.
- **What moved** (`docs/evidence/7.62/README.md`; the rule in `docs/evidence/7.62/rule.patch`):
  Poland's Berlin (day 28, men 0) is gone, its first strike day 35 at a Soviet army: met. But the
  critic's France of R8-B1 (seed 7127, PLAN 7.18's test "France struck") never strikes in 100 days:
  its only strike before was Berlin, capital 0.3, men 0, 334,000 people (days 59–60); with the rule
  its best place in reach is an enemy army at utility 0.005–0.019 against the floor 0.025. The test is
  red in the gate and again alone, and is not weakened, so the rule is not on `main`. On the 30-year
  seeds: empty-capital first strikes 6 → 0, each replaced by a strike on an army (1,238,135 dead, 135
  men → 158,709, 89,709 men), but civilian bursts 20 → 21 (bar 13) and strikes back 21 → 23 (bar
  unchanged): the worlds part at the first changed decision; on HEAD only 5 of the 20 civilian
  bursts were the rule's kind.
- **The conflict:** run 8's R8-B1 (the editor-armed France and Poland never strike) and run 11's
  objection (an empty Berlin struck for its civilians) meet on one case. A variant that lets France
  strike an empty Berlin lets Poland do the same (its Berlin was in extreme desperation too, 1.03).
- **What is left:** the user's. (a) no rule (ADR-611 d): the France test stands; (b) the rule in
  (`git apply docs/evidence/7.62/rule.patch`) and the France test's claim amended to what the rule
  makes (no strike in 100 days, its best place an army under the floor), the test change the user's;
  (c) kept open. Meanwhile the loop takes the next task.

### RESOLVED 2026-10-22 (option a, the user's decision: 7.70b ticked; 7.73 won the fight back) · PLAN 7.70b: the new front is in; by a side with a front of its own 12.6 % → 23.0 % of the open wars, engaged per war-day 0.238 → 0.219, bar not below HEAD's (2026-10-21, ADR-623; the user's decision)
- **The bar** (the whole's, PLAN 7.70, read for 7.70b): on the critic's 48 saves, 180 days
  (`newFronts.ts`, new), the wars with a landing more than DEPLOY_RANGE_CELLS from every front cell
  of the lander's own that holds 30 days on, in at least a fifth of the open wars (a side with
  transports of a division's room and an enemy coast it reaches by sea); engaged per war not below
  HEAD's; no invasion AI call over 50 ms; no nation in debt for it; the unit test, red without.
- **What moved** (`docs/evidence/7.70/b.md`): as the AT is written, 88/310 (28.4 %, HEAD) →
  101/304 (33.2 %), over a fifth before and after, as a lander with no front at all counts; by a
  side with a front of its own (a Normandy proper) 39/310 (12.6 %) → 70/304 (23.0 %): met. Japan
  39, Germany 19, Britain 15, the Netherlands 13, the United States 12 of the 131 such landings
  that held. No lander in debt; longest call 10.3 ms. `normandy1938.test.ts` holds, red without.
  Engaged land formations per war-day 0.238 → 0.219 (−8 %, lower in all four batches): missed.
- **Why it misses** (likely, not measured): the target's worth is divided by the enemy's
  formations near, as the task asks, so the armies land where nobody fights; the group holds the
  turn while its rest marches to the port, so the ferry, whose landings reach the fights, gets
  fewer turns (landings 638 → 555); `frontHeld` holds at none against none. Filed as PLAN 7.73.
- **What is left:** the user's. (a, recommended) 7.70b ticked on its rule's own case and the
  fronted reading, 7.73 to win the fight back; (b) closed not done, the rule kept, 7.73 next;
  (c) kept open. ADR-623 proposed. Meanwhile the loop takes PLAN 7.70c (the follow-through).
- **Also found:** every landing and ferry trip carries one formation (the first's order sets the
  transports sailing; `tryLanding` takes standing transports alone): PLAN 7.72.
- **2026-10-22, PLAN 7.73 done** (7.72, 7.73a–c; ADR-625–628): on the same read, engaged per
  war-day 0.2400 against this bar's 0.2383 (HEAD before 7.70b), fronted 75/308 (24.4 %), no
  lander in debt, longest call 12.6 ms. The fight lost is won back; the decision stays the user's.

### RESOLVED 2026-10-22 (option a, the user's decision: 7.70a ticked, the tick cost logged; the scope: option b, the user's decision the same day, done as PLAN 7.75, ADR-630) · PLAN 7.70a: supply over the beach is in; seed 99's first-year tick 2.35 → 2.44–2.48 ms, budget 2.4 (2026-10-21, ADR-622; the user's decision)
- **The bar:** a division ashore on an enemy coast with no port keeps supply at least 0.5 for 30
  days and loses it under an enemy-held zone (a unit test, red without); seed 99's year: no tick
  over budget (the profile); SPEC §6.2 amended; the ADR; the pin's entry.
- **What moved:** all but the budget. `beachSupply1938.test.ts` holds (at least 0.5 for 30 days,
  0.75 after a day; dry under the enemy's zones), red without. SPEC §4 and §6.2, ADR-622, pin
  32761b44 → cd6ce5eb. The tick: supply 0.161 → 0.28 ms; the tick mean alone 2.35 (HEAD, 98 % of
  the budget) → 2.44–2.48; side by side, both core orders, +0.07 to +0.18.
- **Why it misses:** the beach sources are found at each refresh hour by a scan of the 27,619
  coast cells (0.32 ms, reads scattered over the grid) and searches of the sea (0.17 ms), and the
  hourly pass checks each fed formation's land (+0.037 ms); the rest is the world going otherwise
  (37,245 → 38,821 cells flipped). The searches and banks were made cheaper on the way (the hash
  held); what is left is near the floor of reading those cells.
- **What is left:** the user's. (a, recommended) 7.70a ticked on its rule's own case, the tick
  cost logged (PROMPT: a tick over budget is fixed before the next task that needs a full sweep);
  (b) closed not done, the rule kept; (c) kept open. Meanwhile the loop takes PLAN 7.70b.
- **Scope, for 7.70b (the user's):** per 7.70a's "a landmass where it has no source of its own",
  a beach on a land where the bloc holds a city is not fed: Britain's bloc (India) or the Soviet
  Union landing in France or Norway, Germany in Norway; so most great-power landings of 7.70b, on
  Eurasia, would starve. (a) keep it per land, 7.70b aims at lands with no city of the lander
  (islands, the Americas for Europe's powers); (b) widen it: a held coast cell that the city
  network does not reach is a source (feeds coastal pockets too, a Courland; a rule change, a new
  pin, its own task before 7.70b).

### RESOLVED 2026-10-21 (option a, the user's decision: 7.69 ticked; 7.71 dropped) · PLAN 7.69: the AI's landing on an enemy capital on a coast is in; such capitals landed on in 180 days 8 → 26 of 99, bar at least half (2026-10-21, ADR-621; the user's decision)
- **The bar:** of the enemy capitals on a coast of a land with no port of their nation, in the wars
  of the critic's 48 saves whose other side has transports and no land front with them, a landing
  on that capital's land within 180 days for at least half (`capitalLandings.ts`); no invasion AI
  call over 50 ms.
- **What moved** (`docs/evidence/7.69.md`): 8 of 99 (HEAD, none off the continents) → 26 of 99 (18
  off them; the Netherlands' islet, land 529, 2 of 6; the Raj's, 531, 0 of 13). Longest call 5.0 ms.
  The unit test (Britain lands on the Netherlands' portless islet capital; red without) holds. The
  pin unchanged.
- **Why it misses:** the task's rule is "nearest first": for 121 of the 153 attackers of the cases
  left, an enemy port is nearer by sea than the capital (19 more had the capital as their target
  and landed nowhere in 180 days; 9 had no transports at a port of their own).
- **What is left:** the user's. (a, recommended) 7.69 ticked on its rule's own case and PLAN 7.71
  (filed: a coastal capital with no port of its nation taken before nearer ports) taken next;
  (b) closed not done, the rule kept, 7.71 next; (c) kept open. Meanwhile the loop takes PLAN 7.71.

### RESOLVED 2026-10-21 (option a, the user's decision: the tick stands) · PLAN 7.68: a lost capital moves to the land its nation holds most of is in, ticked on the reading of ADR-620 (a); moves on that land 134 of 138, bar all of them (2026-10-21, ADR-620; the user's decision)
- **The bar:** every `CapitalMoved` to a city in 180 days of the critic's 48 saves lands on the
  landmass where its nation holds the most cells (`capitalMoves.ts`): all of them.
- **What moved** (`docs/evidence/7.68.md`): 128 of 136 (HEAD) → 134 of 138; of the moves whose
  nation held a city on that land, 128 of 133 → 134 of 134. The unit test (Japan's capital to
  Honshu, not Korea; red without) holds.
- **Why it misses:** the four left have no city of their nation on the most-held land (Cuba twice,
  6 cells against 18 and 21; Nationalist Spain, 14 against 60; Greece, Crete's 32 against the
  mainland's 38); the task's rule takes a city, so they go to a city elsewhere.
- **What is left:** the user's. (a, recommended) the tick stands, the AT read as "every move whose
  nation has a city on that land"; (b) a field capital on the most-held land instead of a city
  elsewhere (a rule change, a re-read, a new pin); (c) unticked, reopened. Meanwhile the loop takes
  PLAN 7.69.

### RESOLVED 2026-10-21 (option a, the user's decision: 7.67 ticked) · PLAN 7.67: new divisions of a nation fronted through an ally alone raised toward that front is in; such island formations after 180 days 493 → 466, bar under 369.75 (2026-10-21, ADR-619; the user's decision)
- **The bar:** the island formations of nations with no front cell of their own after 180 days of
  the critic's 48 saves together (`islandArmies.ts`, `noOwnFront`) under 0.75 × HEAD's (493); no
  formation raised on land 529 in 180 days of 1129 year 20; no production call over 50 ms.
- **What moved** (`docs/evidence/7.67.md`): 493 → 466 (−5.5 %), 8 saves fewer and 5 more, the
  runs' divergence the most of it. None raised on land 529, but none on HEAD either (the
  Netherlands holds a front cell of its own on 141 of the 180 days; few formations are raised so
  late). Production's longest call 7.8 ms. The unit test (a division raised on the allies' front's
  land, else at a port, not on the capital's portless islet; red without) holds.
- **Why it misses:** the figure is of the armies standing on day 1, which only the ferry moves, a
  group's room at a time; the rule moves only the formations raised in the 180 days.
- **What is left:** the user's. (a, recommended) 7.67 ticked on its rule's own case; (b) closed
  not done, the rule kept; (c) kept open until 7.68 (the capital's place) is read with it.
  Meanwhile the loop takes PLAN 7.68.

### RESOLVED 2026-10-21 (option a, the user's decision: 7.66 ticked) · PLAN 7.66: transports bought for a nation fronted through an ally alone is in; such island formations after 180 days 482 → 493, bar under 361.5 (2026-10-21, ADR-618; the user's decision)
- **The bar:** the island formations of nations with no front cell of their own after 180 days of
  the critic's 48 saves together (`islandArmies.ts`, `noOwnFront`) under 0.75 × HEAD's (482).
- **What moved** (`docs/evidence/7.66.md`): 482 → 493, noise. The rule works on its own case (the
  unit test: a group queued, red without), and on the saves 10 of 119 watched nations have a
  transport group more by day 180 (215 → 225); none in debt. But a group takes a month or more to
  come, and the runs' divergence (Britain with or without a front cell of its own on a day: 6151
  year 10 63 → 0, 7019 year 20 0 → 133) outweighs what it carries.
- **Why it misses:** the named cases (the Netherlands and the British Raj on 8693 year 20) stand on
  landmasses where their nation holds no port: the want sees their allies' front now, but no port
  of theirs to board at, so neither the want nor the ferry takes them. PLAN 7.67, filed.
- **What is left:** the user's. (a, recommended) 7.66 ticked on its rule's own case (the want reads
  the ally's front as the ferry does; the groups come); (b) closed not done, the rule kept; (c) kept
  open until 7.67 is read with it. Meanwhile the loop takes PLAN 7.67.
- **Decided** (2026-10-21, the user): option a: PLAN 7.66 ticked on the rule's own case.

### RESOLVED 2026-10-21 (option a, the user's decision: 7.64 ticked) · PLAN 7.64: the ferry for a nation fronted through an ally alone is in; such island formations after 60 days 850 → 696, bar under 425 (2026-10-21, ADR-617; the user's decision)
- **The bar:** the island formations of nations with no front cell of their own after 60 days of
  the critic's 48 saves together (`islandArmies.ts`, `noOwnFront`) under half of HEAD's (850).
- **What moved** (`docs/evidence/7.64.md`): 850 → 696 (−18 %). The rule has two halves, each needed:
  the allies' front cells for the ferry, and a landing that ships nobody leaves the turn (it took
  970 of the 1,521 days of the watched such nations). The ferry ships them now, a group's room at a
  time: the Netherlands by 1–3 formations in each of nine saves, Australia 8 → 5, Britain on 2347
  8 → 4, the United States 212 → 211. Engaged (`warSides.ts`) 0.588 → 0.604 worldwide, 0.133 →
  0.137 per war. The unit test, the ADR, the pin and the 50 ms bound (5.8 ms) are met.
- **Why it misses:** the transports. Such a nation has as a rule one group of 24,000 men, a voyage of
  weeks between its island and its allies' front; some have none, and the want that buys them
  (ADR-614) reads the nation's own front, so it buys none for the ferry: PLAN 7.66, filed.
- **What is left:** the user's. (a, recommended) 7.64 ticked on its rule's own case: such a nation
  is ferried now (its transports sail for its army and take it to its allies' front), the rest of
  the bar is 7.66's transports; (b) closed not done, the rule kept; (c) kept open until 7.66 is read
  with it. Meanwhile the loop takes PLAN 7.66.
- **Decided** (2026-10-21, the user): option a: PLAN 7.64 ticked on the rule's own case.

### RESOLVED 2026-10-21 (option a, the user's decision: 7.63 ticked) · PLAN 7.63: the ferry's port nearest the front is in; within 60 cells on day 60 at 69 %, bar 80 % (2026-10-21, ADR-616; the user's decision)
- **The bar:** of the formations ferried and landed in 60 days of the critic's 48 saves
  (`ferryLanded.ts`), within 60 cells of their front on day 60 at least 80 %.
- **What moved** (`docs/evidence/7.63.md`): 66 of 133 (50 %, HEAD) → 70 of 102 (69 %). Landed
  beyond 60 cells 41 → 7. Fewer land in the 60 days (133 → 102): a port by the front is a longer
  voyage. On the critic's case (7019 year 10, read 180 days) Britain lands at Jinxi in China, 64–93
  cells from its front, on days 74 and 119, where it landed at Wilhelmshaven and Constanța
  (524–626) before. Engaged (`warSides.ts`) flat at 0.588 worldwide, 0.133 per war. The unit test,
  the ADR, the pin and the 50 ms bound (5.6 ms) are met.
- **What is out of the port's reach:** of the 102, 10 are the landing AI's beachheads on a land with
  no front (the read counts every formation that boards and lands), 8 landed by a front gone from
  their land by day 60, 7 died. Of the 77 alive by a front of their nation on day 60, 70 are within
  60 cells (91 %).
- **What is left:** the user's. (a, recommended) 7.63 ticked on its rule's own case: the bar read on
  the ferry's own landings, alive by a front on day 60, 91 %; the far landings 41 → 7; (b) closed
  not done, the rule kept; (c) kept open for a second rule on the seven left (a port whose land's
  front is beyond 60 cells of every port of the nation's: Japan's in Korea, the Netherlands at
  Mombasa; the remedy, a landing at a coast with no port, is a design choice). Meanwhile the loop
  takes PLAN 7.64.
- **Decided** (2026-10-21, the user): option a: PLAN 7.63 ticked on the rule's own case.

### RESOLVED 2026-10-21 (option a each, the user's decision: 7.49d3 ticked, 7.49 closed not done) · PLAN 7.49d3 and 7.49 at its budget: transports bought, both bars of d3 missed; 7.49's AT missed at 20 commits (2026-10-21, ADR-614; the user's decision)
- **The bars:** 7.49d3: the island share of the 48 saves together after 60 days under 20 % (7.49d's,
  with d1–d3 in); the island formations of nations with no transports after 180 days under half of
  HEAD's (397: under 199); no nation in debt for it in a year. 7.49: engaged land formations per war
  in years 2–20 at least a quarter of year 1's on 10 unseen seeds × 20 years.
- **What moved** (`docs/evidence/7.49/d3.md`): the island share at day 60 23.3 → 23.3 % (a group
  ordered on day 1 trains 90 days; nothing it carries lands by day 60), at day 180 21.5 → 19.6 %, at
  day 365 13.9 %; no transports after 180 days 397 → 268 (−32 %); in debt 0 (met). 7.49's AT on seeds
  7401–7410: years 2–20 at 0.052 of year 1's per war (0.30 against 5.79); engaged per war on the 48
  saves 0.134 → 0.137 across d1–d3: the parts fixed what each named, and the land war after year 1
  did not move. 7.49 is at 20 commits (ADR-554): closed by step 8.
- **What is left:** the user's. For 7.49d3: (a, recommended) ticked on its rule's own case (no
  transports −32 %, no debt; the 20 % bar read at day 180, where a 90-day group can have sailed,
  19.6 %: met); (b) closed not done, the rule kept; (c) kept open for a ceiling-free second try at
  the no-transports bar. For 7.49: (a, recommended) closed not done, ticked as 7.40 was, its open
  parts with it (7.49d2's entry below decided with it; 7.49e1 already moved to PLAN 7.65); emergent
  6 judged by the next critic report, 7.63, 7.64 and 7.65 still filed; (b) kept open with a new
  budget for a cause not yet named (what holds two armies on one front apart after year 1: no part
  traced it). Meanwhile the loop takes PLAN 7.65.

### RESOLVED 2026-10-21 (option a, the user's decision: 7.49d2 ticked) · PLAN 7.49d2: the ferry to an ally's port is in; the AT's figure 939 → 934, bar under 470 (2026-10-21, ADR-613; the user's decision)
- **The bar:** the island formations of nations with no own port on their front's land, after 60
  days of the 48 saves together (`islandArmies.ts`'s `noOwnPort`), under half of 7.49d1's same
  read (939: under 470).
- **What moved** (`docs/evidence/7.49/d2.md`): 939 → 934. The rule works on its case (the unit
  test; red without), but its case is 10 of the 1,059 on day 1 (`ferryAlly.ts`): 793 are of nations
  whose land front is an ally's alone, with no front cell of their own, which no ferry takes (the
  ferry and the landing read a nation's own front cells); 187 have no ally's port on that land
  (the Soviet Union's 158 on 5309 year 20, the task's named case: front cells of its own,
  transports at its port, no port of its or an ally's on that land; neither d2 nor 7.64 reaches
  them, and no task is filed for them: the remedy, a landing at a coast with no port or at an
  enemy's port in the same war, is a design choice); 69 no transports at a port.
- **What is left:** the nations fronted through an ally alone, filed as PLAN 7.64 with its own AT.
  The user's: (a, recommended) 7.49d2 ticked on the rule's own case, as 7.49c, 7.49f and 7.54 were;
  (b) 7.49d2 closed not done, the rule kept; (c) kept open until 7.64 lands and the figure is read
  again. Meanwhile the loop takes 7.49d3.

### RESOLVED 2026-10-21 (ADR-611 b, the user's decision: the rule filed as PLAN 7.62) · PLAN 7.52c: cities with no soldiers struck, the rule waits on the user (2026-10-21, ADR-611 proposed; the user's decision)
- **The bar:** an ADR proposed with the options and the measured figures; no rule before the
  user's word (met; 7.52 ticked).
- **What was measured** (`docs/evidence/7.52/c.md`): Poland's Berlin passes at 0.074 against 0.025;
  the dead weigh 0.007 of it; the capital's 0.3 is most of the place's value. Of 7.52b's 15 civilian
  bursts, 13 are on a capital.
- **What is left:** the user's choice in ADR-611: (a) DEAD_COST raised (reopens ADR-572); (b,
  recommended) a capital counts on a first strike only with an army in it (8 removed, all civilian);
  (c) a capital on a strike back only (13 removed, 11 civilian); (d) no rule. Meanwhile the loop
  takes the next task (7.5, the critic, when due).

### RESOLVED 2026-10-21 (ADR-605, option a, the user's decision: 7.60 ticked) · PLAN 7.60: whole fleets 70 % → 12 %, one strike still over half; the rule is in (2026-10-21, ADR-605; the user's decision)
- **The bar:** on 8693's war (`carrierSink.ts 8693 JAP USA 20`) no carrier strike sinks more than
  half of a fleet that had lost none (8 on HEAD); the carriers' sinkings there within 25 % of 64; on
  4 seeds × 1 year the ships sunk with their whole fleet in one strike under a quarter.
- **What moved** (`docs/evidence/7.60/a.md`): each squadron strikes one ship, picked by hit points
  (ADR-605). Over half of an untouched fleet 8 → 1; sunk 64 → 66 (met); whole-fleet ships 594 of 853
  (70 %) → 126 of 1,083 (12 %, met).
- **What is left:** one strike (hour 449): a lone flotilla of 8 under six squadrons' 6.4 ships of
  fire loses 5. Any rule that keeps the fire sinks 5 or more; under the bar only by less fire, which
  is tuning (not done). The user's: (a, recommended) 7.60 ticked, the first bar read as met in kind
  (8 → 1, a strike of more fire than half the fleet); (b) 7.60 closed not done, the rule kept; (c)
  keep open for a cut of the carriers' fire (`NAVAL_STRIKE_FIRE` or the wings' size), a balance
  change. Meanwhile the loop takes 7.61.

### RESOLVED 2026-10-21 (option a, the user's decision: 7.56 ticked) · PLAN 7.56: 1129 boards, 8693 cannot; the rules are in (2026-10-21, ADR-596, ADR-597; the user's decision)
- **The bar:** on the 48 saves, the two cases (8693 year 10 Germany, 1129 year 20 Britain) board a
  formation within 60 days of their save.
- **What moved** (`docs/evidence/7.56/a.md`, `b.md`): 1129 boards (0 → 1): the operational AI no
  longer takes back a formation on its march to the transports' port (7.56a), and the landing's
  target is a port in the transports' waters, not Baku on the Caspian (7.56b). 7.54's count 7 → 6.
- **What is left:** 8693. The measure: `sailToArmy`'s pick is quick (6.4 days' sail, 5 days' march to
  Antalya), but by day 10, when the transports stand there, 183 of Germany's 190 formations on that
  land are on the operational AI's marches; the 7 free stand 58–109 days of desert from every German
  port. 7.56's "DRY_SPEED" was wrong: the slow ones are on foot. No rule of the landing's routing
  reaches it. The user's: (a, recommended) 7.56 ticked on its rules' own case (1129: 0 → 1), 8693
  read as an army that is the fronts'; (b) 7.56 closed not done, the rules kept; (c) a rule that lets
  the landing take formations from the operational AI's marches, a design change (an ADR proposed
  when taken up). Meanwhile the loop takes 7.55.

### RESOLVED 2026-10-21 (option a, the user's decision: 7.54 ticked) · PLAN 7.54: the send and the transports' port fixed, the AT's count 9 → 7; the rules are in (2026-10-21, ADR-594, ADR-595; the user's decision)
- **The bar:** on the 48 saves, the four cases of 7.49f §3 (4513, 7247, 8693 year 10 Germany; 1129
  year 20 Britain) board a formation within 60 days; the nations on `send` 30+ of 60 days with none
  boarded (`islandArmies.ts`) 9 → 5 or fewer; no invasion AI call over 50 ms.
- **What moved** (`docs/evidence/7.54/a.md`, `b.md`): 9 → 7; the cases 2 of 4 board (4513, 7247; the
  transports had stood in a German exclave). Longest call 34.5 ms on 1129 alone (36.6 before).
- **What is left:** 8693 and 1129: the transports reach a port by the army in 10 and 30 days, but the
  army's marches there cross desert (65–240 days): PLAN 7.56. The count's others are 7.55's (two),
  7.49f's untraced two and 8167 Lithuania. The user's: (a, recommended) 7.54 ticked on its rules'
  own cases (the refusals and the exclave: 4 nations held so → 0), the rest filed as 7.55 and 7.56;
  (b) 7.54 closed not done, the rules kept; (c) 7.54 kept open until 7.56 lands and the count is
  read again. Meanwhile the loop takes 7.55.
- **Read again after 7.56 (2026-10-21):** the count 7 → 6, bar 5 (1129 boards; 8693 is 7.56's entry).
- **Read again after 7.55 (2026-10-21, ADR-598):** 6 → 6 in 60 days: 5683 Japan and 7247 Germany now order a
  transport group, which trains 90 days.

### RESOLVED 2026-10-21 (option a, the user's decision: 7.49f ticked) · PLAN 7.49f: the rule's own case fixed, the AT's count 10 → 9; the rule is in (2026-10-21, ADR-593; the user's decision)
- **The bar:** on the 48 saves, the nations on `send` 30 days or more of 60 with none boarded
  (`islandArmies.ts`) 10 → 0.
- **What moved** (`docs/evidence/7.49/f.md`): 10 → 9; boarded 6 / 0 → 6 / 1. The critic's named case
  (2081 year 20, Germany at Glasgow) boards. 7.49d §4 had put all ten on the far water; only that
  one plans from such a port. Island share and engaged per war flat.
- **What is left:** the nine: the march to the port refused and the send ended at the first refusal
  (4 nations: PLAN 7.54), the transports' room under a division's (3: PLAN 7.55), two untraced
  (8011 Germany, 6421 Australia, fronted elsewhere). The user's: (a, recommended) 7.49f ticked on
  the rule's own count (1 → 0), the AT read as mis-measured; (b) 7.49f closed not done, the rule
  kept; (c) 7.49f kept open until 7.54 and 7.55 land and the count is read again. Meanwhile the
  loop takes 7.54.
- **Read again after 7.54 and 7.56 (2026-10-21):** the count 10 → 9 → 7 → 6, bar 0; 7.55 still open.
- **Read again after 7.55 (2026-10-21, ADR-598):** 6 in 60 days; its three cases order transports (90 days' training).

### RESOLVED 2026-10-21 (ADR-592 a, the user's decision: the cut as PLAN 7.49e1, bar 1.05 ×) · PLAN 7.49e: the defenders' purse cannot raise the band's army to the bar; no rule (2026-10-21, ADR-592 proposed, the user's decision)
- **The bar:** the land formations of nations at war of income 150–500 after 180 days of each of
  the 48 saves at least 1.5 × HEAD's same run (564 / 564 → 846).
- **What moved** (`docs/evidence/7.49/e.md`, measured, no rule): the reserve cut at war under the
  peacetime share, none kept, 616 / 603; one month, 596 / 590; no reserve and no slot limit, 632 /
  615. Gold still stops 284 / 218 band-months, one order in training at a time allows two divisions
  in 180 days (252 against the gap of 282), and the warship's saving 70 / 46 months.
- **What is left:** the user's (ADR-592): (a, recommended) the cut landed, bar 1.05 × of the 48
  saves together; (b) the cut and the cadre division ordered at war, bar kept, as a numbered task;
  (c) 7.49e closed not done. Meanwhile the loop takes 7.49f.

### RESOLVED 2026-10-21 (ADR-591 a, the user's decision: the ferry as PLAN 7.49d1, bar under 20 %) · PLAN 7.49d: the transports cannot carry the home armies to the bar; no rule (2026-10-21, ADR-591 proposed, the user's decision)
- **The bar:** the island share (land formations of nations at war on a landmass with no front of
  their nation) on the 48 saves after 60 days under 10 %.
- **What moved:** nothing (measured, no rule; `docs/evidence/7.49/d.md`). HEAD 21.8 % / 29.6 % at
  years 10 / 20. 62–66 % of the island formations are of nations with a front in each war on another
  landmass, which no rule ships (`planLanding` only lands in a war with no front). A perfect ferry
  to their own front ports would leave 13.2 % / 21.1 % (weekly loading), 10.7 % / 17.6 % (daily):
  one or two transport groups a nation against 8.5 × their room in island men.
- **What is left:** the user's (ADR-591): (a, recommended) the ferry, bar reset to under 20 % of the
  48 saves together; (b) the ferry and transports bought for a home army, bar kept; (c) 7.49d closed
  not done; (d) a muster-style redeploy. A second cause found, a defect (formations sent to a
  port's land cell, loaded only near its water): PLAN 7.49f. Meanwhile the loop takes 7.49e.

### RESOLVED 2026-10-21 (option a, the user's decision: 7.49c ticked) · PLAN 7.49c: the bar met, Britain's guard missed on drift; the rule is in (2026-10-21, ADR-590; the user's decision)
- **The bar:** on the 48 saves, nations at war with 3 formations or fewer stopped at the month start by
  the warship's saving with no order, 0 (10 and 11 before): **met** (0 / 0, all 48 order a division).
  The guard: Britain's `spentArmy` months on 7019 and 3613 "as 7.47's (4 / 12), no higher".
- **What moved** (`docs/evidence/7.49/c.md`): Britain's months HEAD 20 / 8 → 35 / 16. The rule's own kind
  for Britain (`armed/navalFoe`) 0 → 1 / 0 → 0; the rise is in land wars (19 → 29, 6 → 11) and peace
  (1 → 5, 2 → 5), where the rule reads the same before and after. 7.47's 4 / 12 were read on other code;
  HEAD stood at 20 on 7019 before this rule.
- **What is left:** the user's: (a, recommended) 7.49c ticked on its bar, the guard read as the world's
  drift; (b) 7.49c closed not done, the rule kept; (c) the guard kept and 7.49c left open until the next
  critic report. Meanwhile the loop takes 7.49d.

### RESOLVED 2026-10-21 (ADR-587 a, the user's decision: 7.53 closed not done, 7.53b kept, rivalry not landed) · PLAN 7.53c: rivalry moves no armed war; the bar missed (2026-10-21, ADR-587 proposed, the user's decision)
- **The bar:** armed wars a world in years 2–20 on the 4 tuning seeds at least twice 7.53a's (0.57 →
  1.14); 7.53's own, 1.5 on 10 unseen seeds.
- **What moved** (`docs/evidence/7.53/c.md`): with rivalry in its three forms 0.54–0.64; great pairs at
  war 1.16 → 1.68 without a floor on what is great, 1.93 with and without the motive when there is one.
- **What is left:** the armies of the weaker side are not at the front (PLAN 7.49b–e), and from year 10
  the world has 2 powers of a quarter of the strongest's strength. Not landed; the user's (ADR-587).

### RESOLVED 2026-10-21 (ADR-578, option a, the user's decision: the floor stands, 7.46b3 closed not done) · PLAN 7.46b3: Japan's gold months need a saving in a land war, which ADR-557 rules out; no rule (2026-10-20, ADR-578 proposed, the user's decision)
- **The bar:** Japan's `gold` months on 4 seeds × 10 years with the chase halved, 76 / 48 / 65 / 88
  → 38 / 24 / 32 / 44 (seeds 1307, 3613, 8693, 7019).
- **What moved:** nothing this task (traced, no rule). With ADR-574 and ADR-575 they stand at
  52 / 82 / 62 / 66 (`docs/evidence/7.46/b3.md`).
- **Why:** of the 262 months, 76 are a navy rebuilt to a ship or two at war with a naval enemy
  (PLAN 7.47's case), 144 are a war with no naval enemy while Japan's army stands under its
  peacetime share (ADR-557 keeps that army first), 40 a lost navy's climb while the saving holds.
  Every navalFoe month taken away leaves 11 / 63 / 38 / 34: 3613 and 8693 still over.
- **What is left:** the user's (ADR-578): the floor kept and the task closed with the reason, or
  the saving in every war. PLAN 7.47 takes the navalFoe months either way.
- **Read with PLAN 7.47 (2026-10-20, ADR-579):** 37 / 45 / 27 / 44 against 38 / 24 / 32 / 44: under
  on 1307 and 8693, at the bar on 7019, over on 3613 (24 of its 45 a land war's).

### RESOLVED 2026-10-21 (ADR-584, the user's decision: 7.46b2 closed not done at its bar, 7.46 done) · PLAN 7.46b2: Britain's army months at war fall by more than half but miss the bar; the rule is in (2026-10-20, ADR-575)
- **The bar:** Britain's `spentArmy` months on seeds 7019 and 3613 under 12 each, on 4 seeds × 10
  years with the chase (`docs/evidence/7.39/b-chase.diff`) and ADR-574.
- **What moved** (`docs/evidence/7.46/b2.md`): 75 / 97 → 33 / 29. The rule's case, a navy lost at
  war with an enemy that has an armed fleet, 0 months on both seeds.
- **What is left:** a navy rebuilt to a ship or two is no longer "without a navy" and the saving
  ends (23 and 22 months: PLAN 7.47); a lost navy in a war with no naval enemy (10 and 7: the
  task's text leaves it out, no task). The world's armed power read fell (41–48 % of HEAD's at
  years 3–5, b1 52–60 %): it builds more and the chase sinks it again.
- **Next:** PLAN 7.46b3, then 7.46c; 7.47 when taken.
- **PLAN 7.47 done (2026-10-20, ADR-579, `docs/evidence/7.47.md`):** the rebuilt navy's months at
  war with a naval enemy 9 / 11 → 0 / 0. Britain's `spentArmy` months of every kind now 4 / 12 on
  7019 / 3613 (bar under 12: met on 7019, at it on 3613); left a war with no naval enemy (3, 5)
  and peace (1, 7). The entry stays open for 7.46c's read.
- **Read at PLAN 7.46c (2026-10-20, ADR-580):** the chase to be adopted on 7.39b's bars; Britain's
  months are 7.47's read above (the code is that run's). The entry stays open: 3613's 12 is at the
  bar, not under it; what is left is a war with no naval enemy and peace, which the task leaves out.

### RESOLVED 2026-10-20 (the chase landed, ADR-580; 7.39b and 7.46c ticked) · PLAN 7.39b: the chase of a far enemy navy halves the far station but sinks the navies; blocked until PLAN 7.46 (2026-10-20; ADR-573 option a, the user's decision, 2026-10-20)
- **The bar:** on the critic's 14 seeds × 30 years, the late fleet-weeks on station with the enemy
  fleet beyond reach halved (886 → under 443 a world-year), and sea battles a world-year in years
  2–30 at least 6.6.
- **What moved** (`docs/evidence/7.39/measure-b.md`, the chase `b-chase.diff`, 4 seeds × 10 years):
  the far station 1,332 → 12.9 fleet-weeks a world-year; sea battles years 2–10 6.4 → 7.3, year 1
  37.3 → 50.8; the world's armed power 259k → 128k from year 2 and still 139k against 177k at
  year 10. The chasers mostly win (122 against 46), and the navies sunk are not built again.
  The AT's run (14 seeds × 30 years, `b/full/`): the far station 886 → 14.5 (met); sea battles
  years 2–30 4.3 → 5.0 a world-year (bar 6.6, missed); year 1 35.7 → 55.0; the world's armed power
  55 % of HEAD's at year 2, 75 % at year 10, 92 % at year 30.
- **What is left:** the cause found, a navy sunk in a decisive war at sea and not rebuilt, is PLAN
  7.46. The chase is re-tried on 7.46's run.
- **Decided** (2026-10-20, the user): ADR-573 a. HEAD stands; 7.46 first, the chase re-tried on its
  run (7.46c).
- **Read at PLAN 7.46c** (2026-10-20, `docs/evidence/7.46/c.md`): re-tried with ADR-574, 575 and
  579 on the 14 seeds × 30 years: far station 53.3, late sea battles 14.7 a world-year (both bars
  met); to be adopted (ADR-580). HEAD without the chase has 12.6; the world's navy with it 47–54 %
  of HEAD's at years 2–5, 75 % at year 30. Not landed: with it the critic's overrun France
  (`nukeOverrun1938.test.ts`) does not strike, PLAN 7.48. Resolved when the chase lands after it
  (`docs/evidence/7.46/c-adopt.diff`).
- **Resolved** (2026-10-20): PLAN 7.48 (ADR-581) made the overrun France strike with the chase; the
  chase landed on `bf4b2bb`, the pin fdd3a67c.

### RESOLVED 2026-10-20 (PLAN 7.44, ADR-571; PLAN 7.45a, ADR-572; read at PLAN 7.45b; 7.38 ticked) · PLAN 7.38's bar on the dead missed at the first read: 4 bursts under 0.1 killing a million on 4 of 24 seeds (2026-10-20, PLAN 7.38e)
- **The bar:** on the critic's 14 seeds and 10 unseen ones × 30 years, no burst with a utility
  under 0.1 that kills a million; no city struck twice in one war; no hydrogen bomb where a fission
  one covers the place's value.
- **What moved** (`docs/evidence/7.38/measure-e.md`): the critic's named places are not struck on
  HEAD; restrikes in a war 0 on the critic's seeds, 5 on the unseen (each with more men than the
  burst before found, ADR-569's new value); hydrogen where fission covers 0 and 0. Under 0.1 with a
  million dead: 2 and 2.
- **What is left, two causes, each a numbered task:** the yield chosen by value alone (seeds 2081,
  9437: a fission strike at the place of higher utility; PLAN 7.44); the dead's cost at doctrine 1.4
  in extreme desperation (seeds 756, 758, Germany; PLAN 7.45, whose run is 7.38's second read).
- **PLAN 7.44 done (2026-10-20, ADR-571):** the yield chosen by the strike's utility; from the
  checkpoints, 2081's and 9437's strikes are fission bursts of 201,183 and 183,183 dead (0.270,
  0.300). Left: PLAN 7.45, then 7.38's second read.
- **PLAN 7.45a done (2026-10-20, ADR-572):** the dead's cost × max(1, 2 − doctrine); from the
  checkpoints, 758's day 9178 not struck, 756's day 8216 already a fission burst on HEAD (7.44's).
  Both causes now have rules. Left: PLAN 7.45b, 7.38's second read (the second re-measure). Likely
  miss: 758's day 9493 shape, 2.0 M dead at 0.072 in extreme desperation under MAD.
- **For the user to read, not counted as misses:** seed 9437's Soviet capital struck in three wars
  (2.58 M, 1.70 M, 0.77 M dead), ADR-566's open question; seed 758's day 10063, a place of 551,000
  people struck 8 days after a burst 3 cells away (455,938 dead) for 8,452 more men: massed men to
  ADR-569, a city struck twice to a reader of the bar's word.
- **RESOLVED (2026-10-20, PLAN 7.45b, the second read; `docs/evidence/7.45/b-read.md`):** HEAD
  `7f87eb8`, the critic's 14 seeds and unseen 761–770 × 30 years: under 0.1 with a million dead 0
  and 0, restruck in a war 0 and 0, hydrogen where fission covers 0 and 0. No burst of a million
  dead on any of the 24 (the first read: 20). 758's day 9493 shape was not met (758 is a tuning seed
  now). Seed 9437's Soviet capital is struck twice in two wars, for 183,183 and 178,111 dead (was
  three, 2.58 M to 0.77 M). Cross-war restrikes on 5861, 761 and 767 are listed for ADR-566, which
  still waits on the user.

### RESOLVED 2026-10-20 (ADR-570, option a, the user's decision: the cases stand under ADR-528's bar) · PLAN 7.37h: seed 9901's three Soviet strikes on a lone division, unchanged by 7.38's rules (2026-10-20)
- **The bar:** PLAN 7.37's, per case: the decision changed by a rule with an ADR, or the measured
  cause here, the user's to accept.
- **Measured** (`docs/evidence/7.37/h-9901-lone-division.md`): on the critic's code with ADR-528,
  three fission bursts on 10,655 to 10,751 men, 0 people killed, desperation 0.99 to 1.18, utilities
  0.025 to 0.055. 7.38b does not apply (fission only), 7.38c's cost is 0 (no people), 7.38d does not
  reach them (427 to 1,696 km from the war's earlier bursts, against 92 km). The value is ADR-528's
  0.43 for a lone division, near NUKE_FLOOR at desperation about 1.
- **Options:** ADR-570 a (the cases stand, recommended), b (fewer than two divisions not weighed
  outside extreme desperation), c (a warhead's cost growing as the stockpile shrinks).

### RESOLVED 2026-10-20 (ADR-563, option a, the user's decision: restraint, then means lost) · PLAN 7.37's Czechoslovakia: it dies holding its 10 warheads (2026-10-20, PLAN 7.37b1)
- **The bar:** PLAN 7.37's, per case: the decision changed by a rule with an ADR, or the measured
  cause here, the user's to accept.
- **Measured** (seed 5309, `docs/evidence/7.37/`): its strike under NUKE_FLOOR while its bomber
  lived (utility −0.11 to −0.07, desperation 0.51 to 0.70, not extreme); the bomber lost with
  Prague's airbase, its only one, on day 10.8 (`fallBack` found no base); over the floor from day
  19 with no means. Its desperation falls 0.70 → 0.21 the day its capital moves.
- **Options:** ADR-563 a (restraint then means lost, recommended), b ("use it or lose it"), c (a
  fallen capital in the desperation). PLAN 7.37b2 and b3 (the means said) go on meanwhile.

### RESOLVED 2026-10-20 (ADR-559, option a, the user's decision: one sortie drawn where a wing is tasked, 0.9 of a live day; 7.36 ticked) · PLAN 7.36's first half: "one sortie drawn for each wing tasked" missed (2026-10-20, PLAN 7.36a)
- **The bar:** at 25 and 10 m/px over a front in contact, a sortie drawn for each wing tasked on
  the part of the front in view, at the critic's probes (seed 7019; 4483 is the same world).
- **What moved** (ADR-558, the relay): at the critic's four close views 0, 0, 0, 0 → 1, 1, 2, 1
  drawn, with 3, 3, 5, 4 wings tasked there; a live day at 25 m/px 0.52 → 0.94 of the moments
  with a wing tasked in view (`docs/evidence/7.36/`, `a-patrol-25m.png`).
- **What is left:** a wing on its base for its turnaround, or a strike past its target, is not
  over the view; "each" holds only with a fiction. ADR-559: a. re-scope to one drawn where a
  wing is tasked and 0.9 of a live day (recommended); b. keep it. PLAN 7.36b goes on meanwhile.

### RESOLVED 2026-10-19 (ADR-525, option a, the user's decision: the bar re-scoped to 0.75; 7.30 ticked) · PLAN 7.30's AT (late operational AI at half of 7.27d's) waits on the user's decision (2026-10-19, PLAN 7.30d, ADR-525)
Seed 732 × 50 years, pinned, after 7.30b and 7.30c2: years 26–50 0.753 ms a tick (0.785 by load)
against the bar 0.536; every year's hash equal to 7.27d's (`docs/evidence/7.30/measure-d.md`).
What is left is spread over every year; the one named broad part, `pocketOf`, can be kept across
ticks only as a new rule. Options in ADR-525: (a) re-scope the bar to 0.75 of 7.27d's after PLAN
7.30e (recommended), or (b) a `pocketOf` rule with the pin moved. PLAN 7.30e (exact) goes on
meanwhile; 7.30 is not ticked until the user decides.
7.30e (2026-10-19, `docs/evidence/7.30/measure-e.md`) found nothing exact left to keep: the band
stays at 0.753; under option (a) 7.30 is done as it stands.

### `godUi1938` "Revive after a Kill": France's name not on the map after its revival (2026-10-18, PLAN 7.25d)
Red at `7302970` (before 7.25d's change, stashed) and after it: `expect.poll(... nationLabels ...
l.id === FRA ...).toEqual(['France'])` gets `[]` after 15 s (`tests/e2e/godUi1938.spec.ts:474`);
France revived on 8,659 cells (10,474 before the Kill). The other nine tests of the file green. Not
tried: when it was last green (the e2e suite runs in full at a phase review), whether the label is
placed and dropped or never placed. Left to the next phase review's run (`npm run check:review`).

### Sweep on seeds 701–710: no stasis on 7 of 10 (2026-10-18, PLAN 7.18g)
`docs/sweeps/2026-10-18-sweep-718g.md`: the same five largest nations 22, 20 and 20 years running on
seeds 702, 704 and 706, the limit under 20; every other criterion on 10 of 10. Not tuned in answer
(one cause per commit; the measure first): PLAN 7.27.

### `seaBattleSeen1938` red in parallel runs under load (2026-10-17, PLAN 7.4f38, 7.4f40)
Red twice this day in large parallel e2e runs (53 spec files with PLAN 7.4f38's change, 7 with
7.4f40's, two unrelated changes), green alone five times (both changes and HEAD before them) and
in a run of 4 files. The failure's message was not kept (the run's output had its summary only).
Not on `tools/gate/knownRed.json`: if `npm run check:review` sees it red twice (in the run and
alone), it goes there with this entry; until then a red of it in a crowded run is load. Not
tried: its error under load, to see which of its waits is short.

### RESOLVED 2026-10-15 (PLAN 7.1k, ADR-403) · `zoomDemo1938` is red for the sim, not for the GPU (2026-10-15, PLAN 7.1e)
`tools/gate/knownRed.json` has it for wall time on a software GPU. On this machine it fails on its
node side, before the page: `expect(max battalion strength / size).toBeLessThan(0.5)` gets 0.672
(`tests/e2e/zoomDemo1938.spec.ts:303`). The same figure on `4e36f27` (before 7.1e's code) and
after it, so not 7.1e's. The battle the spec picks does not bleed its battalions under half in
the hours it watches; why is not found (red since before this task). Left to PLAN 7.1k (find the
battle again or fix the test; not by moving the threshold). The gate of `e640c98`, which had to
edit the spec (its reads of `out.fires`), stopped on it; the rest of the gate was green.
**Resolved:** the battle is found again, in seed 1941's game (a Nationalist Spanish division,
battalions at 0.31 to 0.43 of their men, 54 shots an hour); in seed 1944's the division chosen
also fires no shot in the four hours. The spec passes here (2.7 min); its expectations are
unchanged. It stays on `knownRed.json` for a software GPU's wall time, as its siblings.

### RESOLVED 2026-10-16 (PLAN 7.3f, ADR-439) · PLAN 6.8 sweep: nations alive over 250 in 2 of 10 seeds (2026-10-14)
The sweep with nukes on (`docs/sweeps/2026-10-14-sweep-nukes.md`, seeds 1–10 × 50 years): seeds
6 and 7 had 255 and 253 nations alive in some year; the limit is 250. The other four limits hold
on every seed, riser and faller on 10 of 10. The world breaking up into revolts and releases is
the critic's R4-B3 and R5-B3, deferred to Phase 7 (PLAN 1.42); no constant was tuned in answer
(PROMPT: a failing limit waits for Phase 7 unless a defect of the phase's feature is its cause,
and nuclear weapons are not: fallout's most was 0.65 % of the land).
2026-10-16: the sweeps since keep the limit (seeds 1–10 at L: 141–199 at most; seeds 401–410:
170–231); seeds 6 and 7 at M are not run again. Open under PLAN 7.3, with the break-up.
2026-10-16 (PLAN 7.3f run 1, seeds 501–510 × 50 years at M, after 7.3b–e): at most 95 to 124
alive, half the limit. The limit is not the question any more; the break-up criterion of 7.3a
(the count rising late in a run) is, in 4 of 10 seeds: PLAN 7.3g.
**Resolved:** after ADR-439 (PLAN 7.3g), PLAN 7.3f's run 2 on unseen seeds 601–610 × 50 years
(`docs/sweeps/2026-10-16-sweep-b1-601.md`) is ALL GREEN: at most 67 to 101 alive, the break-up
criterion held on 10 of 10 (× 0.80–1.00). PLAN 7.3 ticked.

### RESOLVED 2026-10-16 (PLAN 1.42i) · PLAN 1.42 / critic B1: the leader-share and top-ten criteria do not hold on every unseen seed (2026-10-03)
Three attempts, each judged by one sweep of 10 unseen seeds × 50 years. The thresholds
(≥ 2 newcomers in the top ten by land, leader-share range ≥ 3 points) were never moved.

| Attempt | Changes | Seeds | Result | Failures |
|---|---|---|---|---|
| 1 | ADR-47 (wars resolve, armies recover, overextension) | 101–110 | 9 of 10, `docs/sweeps/2026-10-03-sweep-b1.md` | 109: range 2.7 |
| 2 | ADR-50 (partners' fronts) + PLAN 1.42c (build queue) | 201–210 | 7 of 10, `docs/sweeps/2026-10-03-sweep-b1c.md` | 204: 1 newcomer; 208: 1 newcomer, range 2.4; 209: range 2.6 |
| 3 | ADR-51 (the winner keeps what it occupies) | 301–310 | 8 of 10, `docs/sweeps/2026-10-03-sweep-b1d.md` | 304: range 2.6; 306: range 1.6 |

- **The pattern:** the Soviet Union is the largest nation in every year of every run (27% at
  the start). The range criterion passes when revolts and lost wars carve it down (to 12–24%)
  and fails when they do not (304 and 306 end at 25.2% and 27.5%). Nothing in the sim makes
  that happen on every seed, and no other nation ever grows towards it. The newcomer criterion
  passed on all ten seeds in attempt 3, with five other criteria.
- **Checks on seen seeds do not predict the sweep:** attempt 2 passed 4 of 4 seen seeds and
  attempt 3 passed 10 of 10 (seeds 101–110) before failing on unseen ones. One seed's 50-year
  range moves by several points between versions of the code.
- **Not tried:**
  1. Measure how fast a front advances against an almost undefended giant (seed 109, year 25:
     78k Soviet men, 170,000 cells, wars at score 0). The checkpoint `.cache/ck/s109-y25.bin`
     was written before ADR-50; rewrite it first.
  2. Rivals that grow: the United States holds 7–9% with aggression 15 and 876k gold unspent
     at year 25; no great power other than the Soviet Union is ever near the top share.
  3. Where Soviet formations die (13 lost in 30 months on seed 109, several out of supply on
     land that flipped back under them).
- **Found afterwards (2026-10-03, the user's question "is the Soviet Union just too big at the
  start?"):** the criteria count cells of a Miller map. The Soviet Union is 26.8% of the owned
  cells and 15.9% of the owned area; Denmark is in the top ten by cells because of Greenland.
  PLAN 1.42d changes the measure to area (ADR-52), with the thresholds as they are. **Retry
  1.42 after 1.42d, judged by area.** This does not explain everything: the leader still only
  shrinks and no rival grows (the items under "Not tried" stand).
- **Criteria rewritten (2026-10-03, ADR-54, the user's decision):** the every-seed rule on
  top-ten churn and leader-share range is replaced by a riser and a faller, each needed in 8
  of 10 seeds. Under an 80% quorum the old two criteria would have passed all three failed
  sweeps, so the quorum alone would have been a relaxation: the measures were replaced by
  ones that need larger changes (a realm × 1.5 up, a top-ten realm a third down; a realm is
  a nation with its puppets). No 50-year run has been judged by them.
  The mechanism is still missing: the leader only shrinks and no rival grows.
- **Seen seeds:** 1–10, 99, 101–110, 201–210, 301–310. The next sweep starts at 401. Do not
  re-run seen seeds under the new measure to claim a pass.
- **Kept anyway:** ADR-47, ADR-50, PLAN 1.42c and ADR-51 each remove a defect found in the
  diagnosis; none of them is a tuning constant chosen to pass a seed.
- **Deferred to Phase 7 (2026-10-03, ADR-58, the user's decision):** balance sweeps are
  suspended until phases 2–6 are complete, and PLAN 1.42 has moved to Phase 7. Not retried
  before then. The critic will go on listing B1 as blocking: PROMPT step 2b says to log it
  and take the next issue. State when parked: 1.42d, 1.42e and 1.42f are done; the last five
  quick sweeps (20 years, seen seeds) show a riser in 6–8 of 10 seeds and a faller in 10 of
  10; no 50-year run has been judged by the criteria of ADR-54.
**Resolved:** attempt 4, after ADR-421 and ADR-422 (the AI's refused orders and long ways):
seeds 401–410 × 50 years ALL GREEN under ADR-54's criteria, the first 50-year run judged by
them: limits 10 of 10, riser 9 of 10, faller 10 of 10 (`docs/sweeps/2026-10-16-sweep-b1-401.md`).
The Soviet Union is no longer the leader that only shrinks: its realm is at 0 km² by year 20 in
five seeds of the quick sweep before it. The critic's own asks (top five unchanged for 20
years, living nations rising for 20 years) are not judged by the sweep; they and the findings
PLAN 1.42 did not decide are under PLAN 7.3.

### RESOLVED 2026-10-05 (`62eb6bc`; marked at the Phase 3 review, PLAN 3.7c) · PLAN 2.12a is in the working tree and not committed: the gate was stopped for want of memory (2026-10-05, 05:29)

- **RESOLVED:** PLAN 2.12a was committed the same day (`62eb6bc`), 2.12b after it (`715eaf3`). The entry is kept for what it says of the machine at its commit limit.

- **What happened:** the full gate for PLAN 2.12a was started at 05:29:06 with the CPU sampler
  beside it. In the unit stage, 41.7 s in, test workers died as they started ("Worker exited
  unexpectedly with exit code 3221225794 during starting state", 31 files and 209 tests done),
  and the gate said "FAILED at test". The harness then stopped both jobs: the system was
  critically low on memory. It says not to start them again unasked. Nothing was started
  again.
- **The machine a minute later:** 12.7 GB of 31.8 GB free; 23.1 GB committed of a limit of
  42.3 GB, with nothing of the gate left running. All processes together hold 8.5 GB of
  private memory and the kernel's pools 2.5 GB: some 12 GB of the commit is with nothing this
  account can see. The unit stage starts 24 workers; it has fitted in every gate until now.
- **Not this task's tests, as far as measured:** the new twin test's two games take 452 MB at
  their peak with the moving tables and 425 MB without (one 1938 game is some 80 MB).
- **State of the work:** the fix, its tests and its documents are in the working tree, with
  PLAN 2.12a ticked and a PROGRESS entry that gives test counts (647 unit, 117 e2e) no gate
  has confirmed yet. Run by hand before the gate and green: typecheck, lint of the changed
  files, the three unit tests, the e2e, the pin; the three ten-year games ran with the new
  check only on the code of before (seed 1 failing, as it should). **Not run on the fix: the
  sweep stage and the e2e suite as a whole.**
- **To go on:** `npm run check` (the full gate), then the commit of PLAN 2.12a with explicit
  paths. Then PLAN 2.12b: its change and its test are set aside in `.cache/p212/`
  (`p212b-commands.patch`, to `git apply`; `commandKinds.test.ts`, to `tests/unit/`).
- **A lead for the slow half hours below:** a machine at its commit limit pages and
  compresses, and is slow in every stage alike. The sampler has not recorded memory; it
  should.

### PLAN 3.10c1d2: France's far end is not manned by the rules of 3.10c1a, 3.10c1d and 3.10c1d2 (2026-10-07)
The case PLAN 3.10c1d was written for: seed 4242 after a year (`.cache/ck/4242-y1-c1a.bin`,
the state of 3.10c1a's game read by today's code), France (nation 19) against Italy. Of its
87 own front sectors, 31 have no French formation within 60 cells.

| France, on its day in eight | day 365 | 373 | 381 | 389 | 397 | 405 |
|---|---|---|---|---|---|---|
| formations (3.10c1d → 3.10c1d2) | 44 → 44 | 39 → 39 | 28 → 25 | 13 → 12 | 4 → 10 | 2 → 6 |
| ranked near the front | 21 → 21 | 11 → 13 | 9 → 8 | 6 → 3 | 2 → 7 | 1 → 4 |
| of them on the march | 19 → 19 | 11 → 11 | 9 → 8 | 4 → 3 | 2 → 7 | 1 → 4 |
| to spare (candidates) | 2 → 3 | 0 → 1 | 0 → 1 | 1 → 1 | 0 → 1 | 0 → 1 |
| sent to the far end | 1 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 |
| own sectors with nobody within the range | 31 → 31 | 32 → 32 | 33 → 33 | 34 → 34 | 33 → 33 | 33 → 33 |

- **Tried:** (1) 3.10c1a: formations far from every sector (France has two); (2) 3.10c1d:
  those near the front that stand still (2 of 21, one sent, formation 238, 139 cells);
  (3) 3.10c1d2: those not on an errand, on the march or not (19 of the 19 on the march
  were not on one; 3 candidates, one sent, formation 213, 121 cells, off its march).
- **Why the table does not move:** no longer for want of somebody to send: there are
  candidates on every one of its days. One of three is sent on day 365 and none after;
  which of ADR-191's limits held the others back (the share of point 3, the three ranges,
  an order refused) was not looked at. And after that day France has no army: 44
  formations, 12 four weeks later. It is losing the war it has, with 21 formations near 87
  sectors of its own.
- **Not tried:** a floor for a sector that has nobody whatever the threat elsewhere (ADR-191
  chose the share over it: "a front that is emptied to fill another"); what a far sector is
  worth (31 sectors in the Sahara that nobody attacks). Both are balance, and wait for
  Phase 7 (ADR-58).

## RESOLVED 2026-10-23 (option a, the user's decision: the rule dropped, 7.98 closed not done, no task) · PLAN 7.98's AT missed: American piles 12 → 19, engaged 0.480 → 0.471 (ADR-663)

- **Bar:** on 821–830 × 20 years American piles of 30+ held 30 days at most 4, engaged per war not below
  0.480 (`docs/evidence/7.98/at.md`).
- **What moved:** the rule (`docs/evidence/7.98/patch`: the ferry's want orders another transport group
  while one trains, while the island army outnumbers the room afloat and in training) thinned the home
  piles and made new ones abroad where the army went ashore (France, India, Africa, East Asia, Spain):
  12 → 19, engaged 0.471.
- **Left:** ADR-663: (a) drop the rule, 7.98 closed not done, the piles to the next critic report
  (recommended); (b) drop it and file PLAN 7.99 to read what holds a landed army at its beachhead; (c)
  commit it anyway. The code is restored; the pin unchanged (b9bff4bd).

## RESOLVED 2026-10-23 (option b, the user's decision: PLAN 7.82c and 7.82d, then the AT on 851–860) · PLAN 7.82's AT missed: stasis over 15 years on 3 of 10 unseen seeds (ADR-665)

- **Bar:** on 10 unseen seeds × 30 years no stasis over 15 years; the battle share in years 10–30 at least
  1.96 % (`docs/evidence/7.82/at.md`).
- **What moved:** on 841–850 3 of 10 over 15 (843 19, 844 17, 845 19), battle share 1.82 %. 843: Denmark
  at war, untouched, growing; 844 and 845: Denmark, Canada, the USA at peace for most of the span.
- **Left:** ADR-665: (a) 7.82 closed not done; (b) 7.82c (the at-war remnant, `b.patch`, from an 843
  save) and 7.82d (the holders at peace: the war choice), then the AT on 851–860 (recommended); (c) 7.82c
  only. No rule; the pin unchanged (b9bff4bd).

## RESOLVED 2026-10-23 (option a, the user's decision: 7.94 closed not done) · PLAN 7.94: the operational AI's half is not in caches (ADR-666)

- **Bar:** operationalAi's mean a tick on a year from HEAD's year-4 save of seed 99 at most 0.40 ms, no
  outcome changed (`docs/evidence/7.94/measure.md`).
- **What moved:** nothing; measured 0.794 and 0.770 ms. Caches could spare 2 of 15 `joinWide` walks and
  42 repeated 'long' orders (about 3 %); the rest is first-time searches in a tuned search.
- **Left:** ADR-666: (a) closed not done (recommended); (b) a rule of fewer searches, the pin moves;
  (c) the 3 % cache, closed not done. The pin unchanged (b9bff4bd).

## RESOLVED 2026-10-23 (option a, the user's decision: 7.95 closed not done, 7.84 done on its first bar) · PLAN 7.95: the share that would save is ADR-615's army (ADR-667)

- **Bar:** fleets in years 10–20 at least 0.9 of `dd3b730`'s and late sea battles not below its, on 10
  unseen seeds × 20 years, with S read first (`docs/evidence/7.95/share.md`).
- **What moved:** nothing yet; the read: the order-months a saving would stop are 82–93 % armies under half
  their peacetime share. S ≥ 0.5 changes 16 and 7 months in ten years.
- **Left:** ADR-667: (a) the smaller navies accepted, 7.95 closed not done, 7.84 on its first bar
  (recommended); (b) S = 0.25; (c) S = 0.5. The pin unchanged (b9bff4bd).

## RESOLVED 2026-10-23 (option b, the user's decision: 7.85 closed not done, PLAN 7.99 for an air war beyond the land war) · PLAN 7.85: the late air war at 0.066 of year 1's, still the land war's (ADR-668)

- **Bar:** on 10 unseen seeds × 20 years air battles in years 2–20 at least a tenth of year 1's, or the
  cause and 7.51b's (c) to the user (`docs/evidence/7.85/at.md`).
- **What moved:** 0.065 (7.51b) → 0.066 on 871–880; the land war's late ratio 0.057 → 0.071.
- **Left:** ADR-668: (a) closed not done; (b) an air rule not tied to the land war, its own task
  (recommended). The pin unchanged (b9bff4bd).

## RESOLVED 2026-10-23 (option a, the user's decision: 7.82c closed not done, no rule) · PLAN 7.82c's AT missed: the landing rule adds orders, not landings (ADR-669)

- **Bar:** from HEAD's save of 843 at year 10, 10 years: with the rule Denmark loses at least 10,000 cells
  and is landed on at least 10 times, without under 2,000; engaged per war on 821–830 × 20 years not
  below 0.480 (`docs/evidence/7.82/c/at.md`).
- **What moved:** Denmark −2.3k cells with the rule, +4.0k without; landed on 20 times with, 22 without;
  orders aimed at it 19 → 65, 82–95 % of the plans on it ending with no transports. Engaged per war
  0.480 → 0.421.
- **Left:** ADR-669: (a) no rule, 7.82c closed not done, 7.82d next (recommended); (b) as (a) and PLAN
  7.100 for the lift to a remnant overseas; (c) the rule committed anyway. The pin unchanged (b9bff4bd).

## RESOLVED 2026-10-23 (option b, the user's decision: 7.82 closed not done, PLAN 7.100 for the walk-in and revolt churn) · PLAN 7.82's AT on 851–860: the stasis met, the front battle's share 1.67 % (ADR-671)

- **Bar:** on 10 unseen seeds × 30 years no stasis over 15 years; the battle share in years 10–30 at
  least 1.96 % (`docs/evidence/7.82/at.md`, last section).
- **What moved:** stasis over 15 years on 0 of 10 (841–850: 3 of 10); the share 1.67 % pooled (841–850,
  before 7.82d: 1.82 %); walk-ins 57 %, revolts 30 % of the changes. 856 at 15 years with Denmark at
  war, untouched.
- **Left:** ADR-671: (a) 7.82 ticked on the stasis, the share to the next critic report; (b) closed not
  done, a numbered task for the walk-in and revolt churn, the bar kept (recommended); (c) as (b), the bar
  HEAD's on the same seeds. The pin unchanged (7c2e4700).

## Watch list (not blocking)

- **From the tenth independent read (PLAN 4.8a, 2026-10-12), suspicions not run:**
  - the economic AI lays up a standing fleet without asking `world.embarked`: transports with
    troops aboard, standing where they stopped, would go with the troops at the next hour;
  - an embarked formation whose transports stand with no land within `AT_PORT_CELLS` stays
    aboard for good: it takes no order, and the invasion AI skips its nation while it is
    (`invasion.ts`, the `aboard` set);
  - `orderLanding` takes a target on a neutral's land (the Calais of 4.5a's test, France at
    peace); the next midnight's repatriation sets the division home. Whether a landing on a
    neutral's coast is an order to refuse is a rule to decide (4.8n decides the transports').

- **The tick after PLAN 3.10 (critic R3-B5, 2026-10-08, `00c2e68`).** The AT holds: five
  years from 1938, pinned to `0xFFFF`, are 1.278 ms on seed 99, 1.326 on 4242 and 1.440 on
  8128 (three runs: 1.434 to 1.444), against 1.5. What is left over is a line under PLAN
  7.1 and no longer waits on this file:
  - *The first year* is over the budget on every seed: 1.98, 1.67 and 2.24 ms. Combat is
    0.90, 0.70 and 1.00 ms of it (PLAN 3.10e was not needed for the AT and was not done).
  - *Seed 8128 beyond its fifth year,* which is what the critic measured: 1.51, 2.06, 2.26,
    1.59 and 1.05 ms in years 6 to 10, 1.557 over ten. In years 7 to 9 the operational AI
    is 0.79 to 1.02 ms a tick (0.26 to 0.48 in the first five) and territory 0.30 to 0.51.
    3.10c found the long orders and 3.10c1 took them away; what the AI's time is in these
    years now was not looked at.
  - *Phase 4's cost* (2026-10-12, PLAN 4.8f; a cloud container, unpinned, one run each):
    seed 99's five years 5.988 ms a tick at `5d9f1a1` (before Phase 4; it ends on 251656a1, the
    hash of the budget machine's 1.341) and 7.079 at `90853a8` (ends on 3b8b45cb): × 1.18, about
    1.58 ms on the budget machine, over 1.5. By system, the five years' means: movement 0.667 →
    1.084, naval combat 0.304, the naval AI 0.237, supply 0.589 → 0.772, bombardment 0.102, sea
    control 0.101, the invasion AI 0.032; combat 1.774 → 1.555. PLAN 4.8i brings it back.
    The T1 frame with the fine mask (ADR-284) is not measured: no GPU here (`npm run bench`
    wants one); for a machine with one.
  - *Phase 5's cost* (2026-10-13, PLAN 5.8e; a cloud container, unpinned, one run each, the same
    hour): seed 99's five years 7.971 ms a tick at `759e1aa` (before Phase 5, ends on 0bf5a7ce)
    and 9.390 at `8075af8` (ends on 9775a3cd): × 1.18, about 1.6 ms on the budget machine at
    the 4.8i figure, over 1.5. The air's own systems: `air` (sorties, fights, AA, strikes, bombs)
    0.603 and the air AI 0.297 ms a tick, the five years' means: 0.90 ms, 9.6 % of the tick. The
    rest moved with the game (the air war is another war): the operational AI 1.875 → 2.206,
    movement 1.080 → 1.256, supply 0.805 → 0.957, combat 1.737 → 1.497. For PLAN 7.1 (ADR-289).
    `tests/sweep/aiSweep3.test.ts` (seed 3's ten years) ran past its 900 s here, 1,064 s, in the
    review's third run (PLAN 5.8w7, 2026-10-14; `aiSweep1` 875 s, `aiSweep2` 839 s alone): on
    `tools/gate/knownRed.json` until 7.1, its assertions unchanged. 2026-10-15 (PLAN 7.1k,
    ADR-403): 158 s alone on the budget machine; off the list.
  - *A march round a bay or over a river, with fleets under way* (2026-10-12, PLAN 4.7h,
    ADR-285; a cloud container, unpinned, about 5 × the budget machine's time): seed 99's
    first year, 9.87 ms a tick (hash 841d4422): combat 3.42, the operational AI 1.40,
    movement 1.30. Of movement, `World.stepWay`: 2,951,069 calls, 63,220 ways found in
    964 ms (0.110 ms a tick), the calls that find one kept 2.3 s with the probe's own clock
    (at most 0.37 ms a tick, 3.7 %). Fleets sail by their paths and do not ask it. The
    naval AI's longest call, 1,956 ms, is the lane graph built at the first sail (once a
    game, PLAN 4.1b): a hitch of the worker, not of the tick's mean (for PLAN 4.8).
  - *One call of 361.7 ms* in the operational AI, year 4 of seed 4242. Not looked at.
  - *Not looked at:* why the quick sweep of 3.7e took 14.2 min against 4.9, and the 19.9 min
    of 40 years of seed 4242 (both in the task's text).
  - *After Phase 6, on the budget machine* (2026-10-15, PLAN 7.1a, HEAD `3649c23`, pinned to
    `0xFFFF`, alone): seed 99's five years 2.285, 2.255 and 2.268 ms a tick (budget 1.5; 1.278
    at 3.10 on this machine), year 1 3.13 to 3.21 (budget 2.4); ends on 700d7a84. Seed 5303's 25
    years 2.389 ms, first five 2.19, last five 1.97 (R4-B5's line holds), years 8 to 10, 12 and
    17 at 3.6 to 4.4 with the operational AI. The parts that take it down are PLAN 7.1c to 7.1l.
  - *After 7.1* (2026-10-15, PLAN 7.1l12, ADR-415, HEAD `4d814c1`, pinned, alone): seed 99's five
    years 1.4755 and 1.4731 ms a tick, year 1 2.094 and 2.092: within the budgets. The call of
    361.7 ms is not found again (7.1l11e).

- **From the eighth read (PLAN 3.7a, 2026-10-07), for the review of Phase 4.** What a player
  can meet of the read is PLAN 3.7j to 3.7n; two of its three suspicions go with the tasks
  that touch their lines (a route of more than 500 km over a cell with no province: 3.7j; a
  NaN place where a path found again is shorter than `pathStep`: 3.7k). The third:
  - *Suspicion, not settled:* `deployOf` (`elements.ts`, older than the lines read) caches
    a deployment worked out at `chain = 4` and serves it to a call at the root. A block's
    place may then hang on which formation was asked first, and the worker asks by the
    camera's box. Pictures and the places of events only. Comparing `deployOf` over all
    engaged formations in two orders of asking would settle it.
- **The watch lists of Phase 3 after its review (PLAN 3.7c, 2026-10-07).** Nine blocks stood
  here since the Phase 2 review (three of PLAN 3.4Rl and 3.5b, four things seen in passing,
  the rests of the sixth and seventh reads), and PLAN 3.5 and 3.6 carried some thirty "not
  done" lines. Every item is now one of four things. What became a task or a line under a
  later task is in PLAN.md and no longer here: nothing waits on this file staying read.
  - **Tasks before Phase 4:** PLAN 3.7g (a tag is tied to its elements, ADR-168), 3.7h (a
    formation is moved across the map in one tick: 43 and 37 in a year), 3.7i (the puppets
    of a nation that dies by the loss of its capital are a dead nation's for up to a month).
  - **Lines under later tasks:** PLAN 4.6 (the war with no land front); 7.1 (the frame with
    many hulls on a GPU; year 1's rise taken apart; the AI's own refused orders); 7.2 (a NaN
    or an `undefined` written to the state; commands with numbers out of range, the line of
    `editPaint` to 1e9 among them); 7.4 (what T2 and T3 show of armour, eleven items; the
    blocks of a contact for the hour after a load; the declutter's four); 1.42 (what the
    retreat, the spearheads, the mix and the allotment left open for the balance).
  - **Carried here, each with why it waits:**
    - *The share of `deploy.test.ts` hangs on one pile-up* (PLAN 3.5b): "after 60 days of
      Germany against Poland most formations in contact have their enemy's elements in one
      view" wants more than 0.9 of a whole-world game's formations in contact on one day. It
      is 100 of 102 in the game as committed and was 99 of 111 in a game that differed by a
      detail of the allotment (ten Chinese divisions about one Japanese division whose block
      is deployed against an eleventh, each stopped at `DEPLOY_REACH` 1.3 cells from it). The
      test was not changed. The next rule that moves the pin may meet it: then it is the
      deployment of many against one that is to be mended, not the test. (PLAN 3.7h and
      3.7i move the pin.)
    - *The Economy tab's balance is income less expenses; research is paid from the treasury
      besides* (the seventh read's suspicion; France: about 51 a month of 1,074). Not
      settled: it wants a month's change of gold beside the figure shown. When the panel is
      next touched.
    - *A refusal of one command that arrives after a second was sent under the same
      selection reads as the second's* (ADR-125, "not done"). Needs two commands within one
      answer's time; when the panel is next touched.
    - *A revived nation keeps the research budget it died with until the month's start*
      (the seventh read's suspicion): the economic AI sets it on the first of the month.
    - *After a command `world.deployed` is filled again by whoever asks* (the sixth read's
      suspicion): a wreck or an hour's slide could start from the formation's place and not
      its block. Wants a snapshot test with a command between two hours; not met.
    - *In a Kill the dying nation emits `CapitalMoved` up to five times*, and for 20 to 33
      of 102 its `NationEliminated` comes before the last `RevoltSpawned` or `LandCeded`
      (the sixth read). `CapitalMoved` is not in the history; no state was found lost.
    - *The random world grows its nations over the graph that wraps at the seam also when
      `loopingMap` is off* (the option is applied after the build). With the seam's items
      of PLAN 7.4 when the seam is looked at.
    - *A save written before ADR-148 keeps the overlord of a nation that was dead in it.*
      Whether a save of an older build loads at all was not tried; no save has a version.
      For PLAN 7.2, if saves are to outlive a build.
  - **Closed, each with its reason:**
    - *Fronts out of reach* (ADR-149): allotted by reach since PLAN 3.5b (ADR-152); refused
      orders in a year 11,420 → 1,074 and 6,585 → 1,517. What is left is the war with no
      front (PLAN 4.6) and the AI's own refusals (PLAN 7.1).
    - *2,979 `MoveRejected` in two years, which orders not known* (the seventh read): the
      same; PLAN 3.5b counted them by cause.
    - *Land occupied with no war behind it in a game without commands* (PLAN 2.16Rg, 45
      cells at tick 2000): PLAN 3.4Rj (ADR-147), a cell taken by a nation not at war with
      its owner is the owner's again.
    - *The toy world's `nations.cols.cells` has two writers, and a formation of strength 0
      was alive in it at tick 500:* a fixture; no player is offered it.
    - *The notes "From 3.6a" to "From 3.6e3" under PLAN 3.6:* the work of 3.6e1 to 3.6e5,
      but for the tags (PLAN 3.7g) and the frame's time with many hulls (PLAN 7.1).
    - *The tick not measured after PLAN 3.5a1* (two reads of a path per order): PLAN 3.5e
      measured the phase's code.
    - *At T2 from 100 m/px outward a tank division is a grid of small marks as any other*
      (PLAN 3.6a): the small mark of PLAN 3.6e3b (ADR-165).
    - *Under Open, "PLAN 2.12a is in the working tree and not committed"* (2026-10-05): it
      was committed that day (`62eb6bc`). Marked RESOLVED and kept.
- `reference/NOTES.md` (the user's taste notes, highest-priority reference) does not exist
  (checked 2026-10-02). Visual/feel decisions rely on `reference/screens/`, the trailer and
  itch/Steam/devlog text, and are marked lower confidence until notes appear.
- The e2e stage depends on machine load: on 2026-10-03 another project's dev server held ~2.5
  cores and the stage took 2.9 min instead of 1.4. The expect timeout is now 15 s.
- Tick time after ADR-47 (2026-10-03): year-1 mean 4.6–5.9 ms on seed 99 against the 1.5 ms
  budget (PLAN 7.1). Hot spots: supply reflood, pathfinding, combat.
  **Eased 2026-10-03 (PLAN 1.42a):** 5-year mean 1.04 ms, year 1 1.92 ms on seed 99. The first
  year of a war-heavy seed is still above 1.5 ms: combat 0.67 ms, AI pathfinding 0.54 ms (long
  marches: a Soviet division sent to the Far East expands ~54,000 cells), supply 0.29 ms.
- Cell A* is not exactly optimal (found 2026-10-03, PLAN 1.42a; SPEC §4 routes): its bound is
  not a strict lower bound across rows of different width. Routes can be ~0.1% longer than the
  cheapest. Not fixed: it would change routes (and the sweep baselines) and slow every search.
  **Measured again 2026-10-03 (ADR-56):** on random grids of 16–64 rows a quarter of routes are
  dearer than Dijkstra's, by up to 15%, with the old and with the octile bound alike; the 0.1%
  above was not a maximum. The map's rows change slowly, so it matters far less there.
- Unit flake (2026-10-03): `tests/unit/scenarioFile.test.ts` ("export: no run history in the
  scenario") failed once in a full `npm test` with a gunzip "incorrect data check" after 43 s;
  alone it passes in 8.5 s, and it passed in every gate run of the day. Not investigated. If it
  recurs, look at the gzip stream round trip under CPU load.
  **Recurred 2026-10-04** (PLAN 1.43c, the third record of this error; the first is the retry in
  `tests/helpers/earth.ts`): `tests/unit/provinces.test.ts` failed to load in one gate run with
  "incorrect data check" from `gunzipSync(readFileSync(admin1-geometry.wsz))`. The file was
  intact (the manifest test checked its sha256 in the same run), no test writes the assets, and
  the file passed alone and in the next gate run. Looked at, not explained: the same read and
  gunzip in a loop gave no error in 72,000 runs over 24 processes (56 s) nor in 36,000 runs over
  24 worker threads of one process (28 s), so it is not zlib or the machine under plain load.
  It has only been seen inside a full vitest run. `provinces.test.ts`, `terrain.test.ts` and
  `data-manifest.test.ts` read the assets without the helper's retry.
  **Review pass 2026-10-04:** there is one loader now (`tools/headless/assets.ts`: `earthFile`
  and `earthAsset`, read again up to three times when the gunzip fails), used by the test
  helper, the headless tools, the preview tool and those three tests. The cause is still not
  known; if the error shows again it is no longer a first read that failed.
- Unit failure, once (2026-10-04, in the gate of PLAN 2.4b): `tests/unit/determinism.test.ts`
  "I5: save bytes → load → save bytes are identical" failed in one full `npm test`: two saves of
  the toy world, 601,576 bytes each, not equal. It passed alone and in the next two full runs.
  - It is not the change under test (the toy world has no elements) and not the gunzip flake
    above (saves are raw sections; nothing is compressed or read from disk).
  - Ruled out: a NaN whose bits differ between interpreted and compiled code (the save has no
    NaN in any float section); a defect that shows in repetition (40 save → load → save round
    trips in one process were identical).
  - The same pattern as the gunzip flake: bytes that are wrong, seen only inside a full vitest
    run. Two readings, neither tested: a real nondeterminism that needs the load of a full run
    to show, or memory that is not reliable on this machine under that load (the gunzip check
    and a byte comparison are both checksums of a large buffer).
  - The test now reports which sections differ, the first differing element and its bytes on
    both sides. **If it fails again, read that message before anything else:** one flipped bit
    in one section points at the machine; a whole section or a value that makes sense points
    at the sim.
- Unit failure, once, its message lost (2026-10-04, the gate of the review pass after PLAN 2.7f–m):
  `npm run check` stopped at the unit stage with 75 of 76 files and 563 of 565 tests passing. The
  run's output had been cut down to its summary lines, so which two tests of which file failed is
  not known. The full `vitest run` straight after passed 565 of 565, and the gate after that was
  green. Nothing else ran on the machine (the reader of the review had finished).
  - Two tests in one file fits neither of the two entries above as written (a file that fails to
    load fails all its tests; I5 is one test). It may be either of them, or a third.
  - **A gate run keeps its whole output from now on** (`npm run check > <log> 2>&1`, then read the
    log). If a unit test fails in a gate run, the message is the first thing to keep.
- **Half an hour in which the browser's sim ran up to 200 times slower (2026-10-04, about 17:07 to
  17:39; the gate of the review pass after PLAN 2.7v–u). Not explained.**
  - *What was seen:* two gate runs in a row failed at e2e, in 11.8 and 11.7 minutes for a stage
    that takes 5.5: four and five tests, all on time. `cityNames1938` had 49 and 7 ticks in
    its four seconds at top speed (every gate of the day before: 590 to 700), and its T1 part
    149 and 49; `handover1938` and `labelFades1938` ran into their timeouts; `tickClock` had no
    pause answered in its tick in twelve tries.
  - *Not the change under test:* with the tree at the commit before (gated green an hour
    earlier, `f5a7083`) the same test had 25 ticks.
  - *Not the machine, as far as could be seen:* no process used a hundredth of a core over three
    seconds, no battery, the High performance plan, nothing listening on the test port, no
    file changed on disk but the pass's own. Looked at between the runs, not during one.
  - *Not the sim:* in Node 2.28 ms a tick over a year of seed 1938; in the browser, stepped,
    1.2 to 2.4 ms a tick.
  - *Then it was gone:* from 17:40 the same test, three times in a row, had 347, 349 and 1,474
    ticks, and the third gate run was green in 5.5 minutes with 348.
  - *One thing measured that may be its ground:* at top speed from the 1938 start, the page's
    own thread is held for about 600 ms by each frame (a 4 ms timer of the page comes 540 to
    620 ms late in every half second), with two frames in a half second and half seconds with
    no tick at all; 271 ticks in the first half second, 30 to 90 in those after. That was
    measured in the healthy time. Whether a frame at top speed always cost that much has not
    been looked at, nor what in it does (the labels, the tiles of a changed map, the counters).
  - *And the spread in the healthy time is wide by itself:* 347 to 1,474 ticks in four seconds
    for one test.
  - **If it comes back:** look while it runs (`Get-Process` by CPU over a few seconds; the
    timeline of ticks, snapshots and frames by half seconds, as above), before running it
    again.
  - **It came back (2026-10-04, about 21:32 to 22:12; the gate of PLAN 2.9b1, twice), and it is
    the whole machine, not the browser.** Still not explained.
    - *What was seen:* two gate runs in a row failed at e2e (13.6 and 14.7 minutes for a stage
      of 7; three and six tests, all on time: 25, 25 and 19 ticks in four seconds at top speed).
    - *The stages that open no browser were slow by the same measure:* the unit stage 92.5 and
      92.8 s (43 to 45 in the gates before and after), the sweep stage 183 and 182 s (115 and
      117; 108 after). The logs of the first time say the same, and it was not read then: the
      unit stage of the two failed runs 88 s, of the green third run 41 s, one tree.
    - *So the browser's hundredfold is the machine's half speed made worse by the pages
      starving each other:* four pages at once at top speed gave 247 to 385 ticks each in four
      seconds where one alone gave 1,411, measured at 22:11, each page with its software
      renderer on some six cores.
    - *Not the change under test, measured:* at 22:25 the first five spec files of the gate, four
      workers, on the tree and on the code of the commit before: 1,012 and 1,175 ticks against
      896 and 1,104, the same test durations.
    - *A guess of mine withdrawn:* that the worker's timer was held back as a hidden page's is.
      A page asked during the slow time's end said visible and in focus, and Node was slow too.
    - *Looked for and not found:* a virus scan (the day's one ran 18:07 to 18:10), an update, a
      processor-power or other event in the system log, a process other than the gate's own
      over a third of a core at 21:50 (three seconds between the runs), a leftover process of
      mine, low memory (16 of 32 GB free).
    - *The healthy gate, sampled every 14 s for comparison* (`gate-29b1c`, 22:18 to 22:28,
      green): the processor at 128 to 158 % of its nominal clock throughout (138 on average),
      about 20 cores' worth used by the browsers in the e2e stage, no other process over one core.
    - *Not sampled: a slow gate.* **From now on a sampler runs beside every gate** (a scratch
      script: `% Processor Performance`, and the processes by CPU, every 14 s). A slow gate then
      shows one of three things: the clock held down (heat, or a limit), another program on the
      cores, or neither with the cores not full (the work kept off the fast cores; then look at
      the load by core).
    - *The entry below on a slow machine is the same picture* (the unit stage 72 s for 40, with
      another project's server known to be busy). Whether another project was busy this time is
      not known; it was not seen at 21:50.
    - *What a red gate of this kind means:* nothing about the tree. The rule stands: no commit
      on red, no limit or worker count changed for it. Run again when the unit stage of a gate
      reads 45 s or less; if it reads 90, the run will fail and the sampler has the reason.
    - *2026-10-09, the sampler's first slow gate* (PLAN 3.12Ro, 07:59 to 08:09, green; `.cache/
      gate-ro.log`, `.cache/gate-ro-sampler.log`, 40 samples). The unit stage 283.5 s and the
      ten-year stage 300.6 s, with "Timeout terminating forks worker" for five files, as in the
      gate of 3.12Rn. The clock at 127 to 150 % throughout: not held down. No process but the
      gate's `node` over one core (the user's Solitaire at up to 1.0). `node` on 4.8 cores on
      average and 7.9 at most, of 24. So it is the third picture: neither, with the cores
      not full. And the sentence above is no prediction: this gate read 283 s and was green.
    - *The sampler is a file now:* `.cache/sampler.ps1` (not in the repository; it is in
      PROGRESS.md of 2026-10-09, PLAN 3.12Ro, if `.cache` is gone). Beside a gate:
      `pwsh -NoProfile -File .cache/sampler.ps1 -Out .cache/<gate>-sampler.log -Stop .cache/<gate>.stop`
      in the background, and `touch .cache/<gate>.stop` when the gate is over.
    - *Next, not done:* the load by core during a gate (`Get-Counter '\Processor
      Information(*)\% Processor Time'`) and the affinity of the gate's processes
      (`(Get-Process node).ProcessorAffinity`). The guess to test: vitest's forks run on the
      efficiency cores, where the same sim code reads up to 1.65 times slower (CLAUDE.md, the
      `--affinity` of `npm run sim`). A guess: nothing measured says so yet.
- e2e, once (2026-10-04, the second gate run of PLAN 2.8c2): `markers1938` waited 60 s for the
  page and it did not come. Its trace has one console error: "Failed to load resource:
  net::ERR_NO_BUFFER_SPACE". The page loaded nothing of the game.
  - Two full gate runs and some thirty runs of single specs had gone before it within the
    hour, each page a dozen requests to the preview server; 153 sockets were in TIME_WAIT just
    before the third run, which was green. That many runs back to back is my guess at the
    cause; not shown.
  - If it comes back in a single gate run on a rested machine, look at the server's and the
    browser's connections (keep-alive of `vite preview`) before running again.
- e2e flake (2026-10-03): `speed.spec.ts` once did not find the speed label within 15 s on `/`
  in a full e2e run; it passed alone and in the next full run (61 passed). No source change was
  involved. If it recurs, look at the page boot under 4 parallel workers.
  **Recurred 2026-10-03** on a 4-core machine in every gate run, with `precision` and `camera`:
  workers now scale to the cores and the spec has a 90 s timeout (PROGRESS of that date).
- Tick timings on the budget machine come in two speeds (2026-10-03, PLAN 1.42e1): the same
  commit measured 1.68 ms and, minutes later with the machine idle, 2.76 ms for year 1 of seed
  99. The processor has 8 performance and 8 efficiency cores, and the slow figure (× 1.65) fits
  a run on an efficiency core (not observed directly). Confined to the performance cores at high priority
  (`.cache/pin.ps1`, a scratch script: affinity mask 0xFFFF) the figure is 1.671 ms twice. A
  tick measurement for a budget is taken that way. Not yet a tool in the repo.
  **A tool since PLAN 1.42e3:** `npm run sim -- … --affinity 0xFFFF` (`tools/headless/affinity.ts`).
  The gate and the sweeps run unpinned: their wall times vary with it, their results do not.
- e2e boot stall (2026-10-03, 4-core machine, 2 workers): `coast1938.spec.ts:91` and
  `nationPanel1938.spec.ts:15` waited more than 60 s for the first frame of
  `/?scenario=1938&paused=1` in one gate run; alone they pass in 5.5 s and 11.6 s, and the gate
  before and after passed all 61. Paused pages run no tick, so the A* change under test was not
  involved. Contention does not explain 10×: if it recurs, keep the trace
  (`test-results/…/trace.zip`) and look at the worker boot handshake.
- **The watch lists of Phase 2 after its review (PLAN 2.11c, 2026-10-05).** Sixteen lists stood
  here, from four independent reads and twelve tasks, each "for the phase review". Every item of
  theirs is now one of four things. What became a task or a line under a later task is in
  PLAN.md and no longer here: nothing waits on this file staying read.
  - **Tasks before Phase 3:** PLAN 2.11e (a formation in contact is drawn walking in place),
    2.11f (occupied land's hatching lies over the ground at T2 and T3), 2.11g (a sprite at T2
    shows nothing of its element's losses).
  - **Lines under later tasks:** PLAN 4.1 (a march across a bay); 4.7 (the sea floor; lakes
    that are there at T2 and not at T1); 7.1 (the instances' cap above 1920 × 1080; the land
    mask held twice; a GPU without textures of 8192 px; fractional pixel ratios; the ground's
    cost without a GPU); 7.4 (the seam of the looping map, seven items; the declutter in a
    crowd and in flight; names and arrows at T1; the ground's look; what T3 shows of a battle;
    picking in a stack; flags by scenario).
  - **Carried here, each with why it waits:**
    - *Tests that hang on something outside them.* None is a defect of the game; each says
      what it lacks when it fails.
      - The zoom demo's battle is found by rule (a division that fires, has stood a day, has
        every battalion above 64 men and under half its strength, a battery with losses, and
        more than 10 shots by or at it in each stepped hour). A pin move can make day 30 find
        another division, or none. "Under half" stays: the close pictures are the evidence
        that losses show at T3, and they show it only on a division that has lost.
      - `coastPicture1938`: two of its nine views have little of one kind to compare (456
        places surely land, 641 surely water; the floor is 300). Its "surely" (3 × 3 mask
        pixels) is stricter than `maskSure`: the band between the two rests on the unit test
        of the two constants and on the 202 elements looked at.
      - `coastElements1938` looks at the 20 formations nearest the water, of 35 within half a
        cell of it, on seed 99 at the start.
      - Bench A's coast is made of blobs: no real coast was timed on a GPU.
      - The demo's frames cost 100 to 200 ms each in the tests' rasteriser: a minute alone,
        1.4 minutes in the gate, a timeout of 300 s.
    - *Every unit test file that builds the 1938 world unpacks the land mask* (once to a
      process). The unpacking that failed three times in parallel vitest runs (above) has one
      more file to fail on. Not seen since PLAN 2.9a.
    - *Close pictures differ from run to run where a formation walks* (the walk's phase is
      the clock's). Since PLAN 2.11e the demo's division stands, and the demo's eight pictures
      of two runs are the same pixel for pixel; a picture with a formation on the march in it,
      close enough for the sway to be a pixel, would still differ.
    - *Land and water painted in the editor are not in the fine mask.* A cell without land in
      the mask keeps its middle, its elements their slots, and the coast there is the cells'.
      By design until an editor paints the mask.
    - *From the fifth read (PLAN 2.11b), not established or not reached:* a figure at the
      edge of an element's footprint, 0.096 mask px from
      its element, can stand where the field is 0.75 and the shore's noise makes sea of it;
      `World.inland` and `cellPoints` do not record `loopingMap`, so a change of that option
      after cells were asked leaves the seam's columns with the old answer;
      `World.standPoint` clamps an x under 0 to column 0 on a looping map instead of wrapping
      (no caller gave one in a year). Each a line to look at when its code is next touched.
    - *Suspicions of the readers, neither established nor met:* a frame later than 1.5 ticks
      after a snapshot, with none following, leaves the sprites short of the tick's end;
      `drawUnitLayers` without `pixels` draws on an overlay that is not cleared (a test hook);
      `FlagStore.pixelsOf` keeps a plain flag in the first colour it saw for an id.
  - **Closed, each with its reason:**
    - *The worker's start with the mask* (PLAN 2.9a, not measured then): measured now. Five starts of the 1938 page, alone, in the tests' rasteriser: the first frame 0.22 s after navigation, the map layers and the page's copy of the mask at 0.95 to 1.09 s, the first snapshot at 1.1 to 1.4 s. Reading and unpacking the mask takes 15 ms in Node. It is not what a start waits for.
    - *The tick's time with the mask* (two unpinned readings then): pinned in PLAN 2.9b1, 1.45
      and 1.44 ms over five years, under the code before the mask (1.50 and 1.49).
    - *The demo stops at 3 m/px and only zooms in:* 1 m/px is `closeZoom1938`'s and
      `ground1938`'s; the way out, at each boundary, `fades1938`'s.
    - *Figures fading out after a flick past 60 m/px are of the tick before:* a quarter of a
      second of a layer that is going.
    - *`nudgeApart` gives other moves for another order of the list:* snapshots list
      formations by ascending id.
    - *The order arrows of markers in a stack are drawn from their own formations:* meant so.
    - *`inBbox` wraps on a map that does not loop:* a view at one edge is sent the formations
      within the pad of the other; they are not in the view and are not drawn.
    - *`snapshotPrev` keeps rows after a second `init` on one worker:* the app inits once.
    - *The toy world has no ground texture and wears 1938 flags:* a fixture; no player is
      offered it. (Flags by scenario: PLAN 7.4.)
    - *Names by counters and by marching armies come and go at top speed* (51 fades begun in
      four seconds at 4000 m/px): at one tick a second it is one in some 40 seconds.
    - *The six pictures of PLAN 2.6 were older than the ground:* shot again in PLAN 2.10b; the
      phase's other pictures are shot again at the end of this review.
- `fire1938.spec.ts`, the running part, under load (2026-10-04, gate run with another job on the
  machine, the e2e stage at twice its usual time): 6,614 fires dropped (expected 0). The worker's
  fire queue is capped at 8,192 and drops the oldest when the view takes snapshots more slowly
  than the sim makes fire. The drop is by design (the view says how many: `firesDropped`); the
  spec's "none dropped" holds on an idle machine only. If it recurs on an idle machine, look at
  the snapshot rate at T2 while the game runs at ×5. The counters' case of the same run is PLAN 2.7l.
- For PLAN 7.1 (2026-10-05, PLAN 2.13): the mean tick of five pinned years of seed 99 is 1.502 ms, at
  the budget of 1.5 (1.203 before). The armies of the start are no longer cut in the first hour: years
  1 and 2 have some 200 formations more and take 2.11 and 1.97 ms a tick. Not tuned (ADR-58).
- **Answered in part by PLAN 2.13 (ADR-86):** the entry below. The 228 are no longer disbanded in the
  first tick; the nations whose income does not carry their army cut it as their gold runs out
  (seed 99: 846 formations after a year, 687 after two). Which budgets are off is still open.
- For Phase 7 (balance; seen 2026-10-04 while writing the test of PLAN 2.7o, not looked into): in the
  first tick of the 1938 world the economic AI disbands 228 of the 1,054 formations (seed 99; the
  same with and without commands), all in `economicAi` step 1, "disband until the books balance".
  That it disbands is decided (the ADR on the economic AI: the order of battle gives some nations
  armies they cannot pay for). How much is not on record: a player who opens 1938 sees, after one
  hour of the game, 78% of the armies the scenario's data gives. Which nations, and whether their
  income or their order of battle is off, is a question for the balance work.
- For Phase 7 (seen 2026-10-05, PLAN 2.16Rg and 2.17c, not looked into): 1938, seed 99, tick
  2000, no command: 45 cells are controlled by a nation other than their owner with no war
  between the two. A Kill no longer adds to them (ADR-119). Where the 45 come from (a war
  that ends for one side, a peace that leaves cells, an alliance joined) is not known.
- For Phase 7 (measured 2026-10-06, PLAN 2.17d2; left as it is by PLAN 2.17d3, ADR-123): a
  province split by a peace stays split through every transfer. A peace moves cells; a
  defection, a revolt, a collapse, a Kill and a revival move the cells of a province that the
  owner of its centre owns (`defect`, `spawnRebels`), and no others. 1938, seed 99: France
  killed at tick 0 and revived two years on holds 8,963 of its 10,473 cells; 1,253 cells of
  provinces whose centre is France's again are Nationalist Spain's (608), three nations' the
  Kill founded (627) and nobody's (18): patches inside France. To be decided with the
  balance: every transfer takes the province whole (and what war, if any, stands behind the
  cells taken from a third nation), or a peace keeps provinces whole, or the patches are left
  to the wars that follow. Not measured: how many provinces a game without commands has split
  after 10 and 50 years.
- Specs that measure time and fail on a slow machine (2026-10-04, gate runs with another project's
  dev server busy on the machine, the e2e stage at 2 to 2.4 times its usual 4.1 min). None was
  changed. If one fails on an idle machine it is a finding.
  - `fallen1938` (2026-10-17, PLAN 7.9a; on `knownRed.json`): fails alone on the budget machine on
    `71c8e01`, before 7.9a: "marks drawn at the day's end" 2 of 3 (a mark faded in 17.5 s of the
    clock; an hour of the test takes 2 to 3 s). With 7.9a (held by the game: 6 drawn) it fails on
    "marks in the view in a day", 5 of 10, with 33 of the fallen marked: the fight about Polish
    division 550 on day 21 of seed 4242 is not the one the spec was written on since the 1938 start
    changed (PLAN 7.4f31, 7.4f32). **Closed** (PLAN 7.9e, the same day): re-aimed at division 544
    (426 men lost on day 22, in contact all day): 73 marks in the view, 74 drawn at the day's end;
    green alone three of three; off `knownRed.json`.
  - `individuals1938`: a frame under 25 ms (170 ms).
    2026-10-06 (the gate of PLAN 3.1d, two runs of the suite, 9.8 and 10.1 min): in the first its
    wait of 60 s for the first frame and the map layers of a paused 1938 page ran out; alone
    (40 s) and in the second run it passed. The load of the machine in the first run is not known.
  - `coast1938`, "off-map rows" (2026-10-06, the second gate of PLAN 3.4d, the suite in 10.3 min):
    its wait of 60 s for the first frame and the fine coast of a paused 1938 page ran out, once in
    138 tests. Alone it passed three of three (2.4 s), and in the next full run. The same wait as
    `individuals1938` above. The load of the machine in that run is not known. The spec was not
    changed.
  - `fire1938`: more than 10 of something drawn in a window of frames (9), and no fire dropped (6,614).
  - `handover1938`: a wait of 120 s. `labelFades1938`: the test's 240 s. `title`: 15 s for the
    title screen, and an autosave read before it was written.
  - `declutter1938`: PLAN 2.7l, done 2026-10-04 (it was not time that it measured: ADR-75).
  - `cityNames1938`, the running part (added 2026-10-04 with PLAN 2.7r): four seconds at top speed
    must hold more than 8 frames, more than 50 ticks and at least one fade of a name. Gate runs
    on the idle machine gave 20 to 44 frames, 235 to 1,561 ticks and 6 to 51 fades.
    2026-10-05 (the gate of PLAN 2.16d): 39 and 31 ticks in one run of the suite that took
    15.6 min, 577 and 330 in the next (9.8 min), 673 and 757 alone. The load of the machine in
    the first run is not known.
    2026-10-05 (PLAN 2.16Rd): five runs of the suite on the idle machine, 9.7 to 10.2 min:
    275 to 617 ticks. The random world's spec is not what slowed the run of 15.6 min.
  - A way to tell: `npm run test` takes 40 s on the idle machine and took 72 s then.
  - `closeZoom1938`, the pan at T3 (2026-10-05, the gate on PLAN 2.12a, the machine idle in the
    second of two runs): 4 and 3 frames in half a second inside the suite, 19 alone. The spec now
    waits for six frames. Not looked into: whether a frame at 5 m/px on 1,584 figures has become
    slower beside other pages since PLAN 2.11g (the unit stage took 47.9 s in that run, 41 at its
    best).
  - `tickClock`, the pause in a tick (2026-10-06, the gate of PLAN 3.2d, the suite in 10.1 min):
    "waited 3000 ms for a frame at the tick's end", once in 138 tests. Alone, three times in a
    row, it passed (the tick's end after 913 to 1,049 ms). It runs the toy world, which has no unit
    rules: the rule of that commit is not on its path. The load of the machine in that run is
    not known. The spec was not changed.
    2026-10-09 (the fourth gate of PLAN 4.1's tick, the suite in 21.0 min): the same, once in
    163 tests; alone it passed (the tick's end after 834 ms). The gate before it had failed
    `fire1938`'s timing and passed this spec. The spec was not changed.
  - `formationFight1938`, the way to the fight (2026-10-08, eight spec files run by hand for
    PLAN 3.11c3b, 17 tests in 1.6 min): "no flight began", its wait of 20 s for the camera to
    start after the press of "To its fight", at one of 31 formations, once. Alone it passed
    (2.2 min). The load of the machine in that run is not known. The spec was not changed.
    2026-10-08 (the gate of PLAN 3.11's tick): the same in `fightSeen1938`, which has the
    same wait, in the suite and twice of two runs of two files. The wait looked for
    `controller.animating` alone and missed a flight over before it began. Both specs now
    read the camera before the press and take a camera elsewhere for a flight begun.
  - `precision`, the bench page (2026-10-07, eleven spec files run by hand for PLAN 3.6c, 17
    tests in 3.3 min): its wait for `window.__precision` on `/bench.html?b=P` ran out with the
    test's 90 s, once. Alone it passed (12.7 s), and in a run with `fire1938` and `bench-pages`.
    It was the last test of the run. The load of the machine in that run is not known. The
    spec was not changed.
  - `fire1938`, the fire layer's time (2026-10-09, the gate of PLAN 3.12's tick): "fire layer
    4.21 ms a frame" against its limit of 4, once, in a suite of 159 tests that took 19.5 min.
    Alone it passed at 0.785 ms; in the gate's second run (19.7 min, green) at 1.334 ms. The
    commit touches nothing the layer draws. The spec was not changed. Not looked into: why the
    suite now takes 19.5 min where it took about 10 (the load of the machine is not known; the
    suite has grown to 159 tests).
    2026-10-09 (the gate of PLAN 4.1's tick, the third gate of that task): the same, "fire
    layer 4.713 ms a frame", once in 163 tests of 20.1 min; alone 0.804 ms. The gate was run
    again. Two gates and seven spec files by hand had run in the two hours before it.
  - `economy.test.ts`, one year of play (2026-10-09, the gate of PLAN 3.12Rn): "Test timed
    out in 120000ms", once, in a unit stage of 289 s (121 s in the gate before, of PLAN
    3.12Rm); vitest also could not end six of its workers in time. Alone it passed (the
    file in 31 s); in the gate's second run it passed (the unit stage 277 s, the ten-year
    stage 275 s where it took 160 s). The commit adds one comparison to a war's end. No
    node process of an earlier run was left, and after the gate no Chromium, esbuild or
    Vite of the specs run by hand before it (20 `msedge.exe` and 33 `msedgewebview2.exe`
    were running, the user's own, not counted before the gate). The load of the machine in those runs is not
    known. The test was not changed. Not looked into: why both stages took about twice
    their time of the gate before (the three ten-year tests alone, with the commit's check,
    took 140 s twice in that hour).
  - `movement.test.ts`, an unreachable pair rejected at once (2026-10-09, the second gate of
    PLAN 3.12Rt): "expected 6.38 to be less than 5" (ms, `findRoute`'s component check on the
    wall clock), once, in a unit stage of 294 s. The gate's first run of the same code passed,
    and the file alone passed after it (34 tests). The commit touches nothing of routes (the
    page's copies of a looping map). The load of the machine in that run is not known (the
    first gate and five specs by hand ran in the hour before). The test was not changed.
  - `tankBattle1938` ("stop 4, tanks") and `fightSeen1938` ("marks drawn at 2 m/px", the
    marks of a day's fight looked at again at 2 m/px) (2026-10-09, four spec files run by hand
    for PLAN 4.2b, 5 tests in 8.3 min): once each, in the one run. The two files alone passed
    after it (3 tests, 5.0 min); both had passed in the full suite of the same game an hour
    before (163 tests, 20.2 min), and `tankBattle1938` in a run of six files. The whole unit
    suite, the ten-year stage and three browser runs had gone before in that hour and a
    half; the load of the machine in that run is not known. The errors' details were not
    read (the run's output was not kept). The specs were not changed.
  - `scenario1938.test.ts` ("builds in well under a second", under 2,000 ms) and
    `snapshot-perf.test.ts` ("within 2 ms for a steady-state snapshot") (2026-10-10, PLAN
    4.2d, a cloud container, not the machine the budgets were set on): both fail alone on the
    unchanged HEAD 348f26c as on the commit, 2,003 to 2,091 ms and 2.03 to 2.27 ms; the build
    passed once in four runs. `territory.test.ts` ("costs little per tick") failed once in
    the full unit stage and passed alone (again 2026-10-12, ADR-279: 33 and 29.5 ms in two
    unit stages, 13 to 19 ms alone, the same at HEAD and with the change: 16.7/12.3/9.8 and
    16.4/12.5/10.1 ms). The commit was made with these three red in its
    gate: the code they time is not touched (the zones and lanes are built at their first
    use). The tests were not changed. The ten-year run of seed 1 (`tests/sweep/aiSweep1`)
    timed out too, 758 s alone against its 600 s: a year of seed 1 here is 8.16 ms a tick on
    the commit and 8.19 on HEAD, the same hash fac8ee64 (1.9 ms on the budget's machine).
    Seeds 2 and 3 and the pinned hash passed. 2026-10-15 (PLAN 7.1k, ADR-403): the three
    timing tests pass alone on the budget machine, three runs of three; off `knownRed.json`.
  - The full gate at PLAN 4.8's tick, the Phase 4 review (2026-10-12, this container), each
    stage run on its own on the tree of 433e749 (the tick adds documents alone): typecheck,
    lint, build, parity green; the ten-year sweep tests 17 of 17 (24 min); the unit tests
    1,262 of 1,265, red only by the three timing tests above (`snapshot-perf`, the
    `scenario1938` build, `territory`'s cost a tick). The browser suite in two halves of the
    chromium project (1.2 h and 45 min): 152 of 171 passed; of the 19 red, declutter, camera
    and t0map passed alone (1 worker), and the perf spec passed (`--project=perf --no-deps`).
    The 16 left are the list of 4.2f and 4.7 (cityNames ×2, fallen, fightSeen ×2, fire,
    formationFight, handover, individuals, labelFades, lateFrame, precision, tankBattle,
    tickClock, ticker, zoomDemo). The specs were not changed.
  - The browser suite on this container at PLAN 4.7's tick (2026-10-12): twice in full (2
    workers) it ran 140 of 172 tests in its 7,000 s, with the same 21 failing both times. Then
    alone, file by file (1 worker): 9 of them (counters, declutter, editorDrag, formationPlace,
    groundThings, markerStacks, muzzles, navalDemo, settings: 19 tests) passed; 16 failed, every
    one of the list of 4.2f (cityNames ×2, fallen, fightSeen ×2, fire, formationFight, handover,
    individuals, labelFades, lateFrame, precision, tankBattle, tickClock, ticker, zoomDemo); camera
    passed; the 19 files the full runs did not reach passed but those 4; the perf spec passed
    (run with `--project=perf --no-deps`: named alone, the perf project's dependency on chromium
    runs all 172).
  - The browser suite on this container (2026-10-10, PLAN 4.2's tick, 4.2f): 17 of 164
    failed in 1.7 h (camera, cityNames ×2, fallen, fightSeen ×2, fire, formationFight,
    handover, individuals, labelFades, lateFrame, precision, tickClock, tankBattle, ticker,
    zoomDemo). The same 14 files on the commit before (4.2e, no change of the page but the
    build list): the same 15 failed, camera and fire passed. Alone on 4.2f fire passed;
    camera passed twice on 4.2f and failed twice on 4.2e (a zoom by E of 12.69 against more
    than 13). Read as the container's speed (frames and ticks counted in a time of the wall,
    a software GPU); the errors read were counts of ticks and frames and distances near
    their bounds. The specs were not changed.
  - The browser suite for PLAN 4.3's tick (2026-10-10, this container): 164 of 165 run
    before its job's two hours ran out (the last, zoomDemo, was red in the run of 4.2f and
    on the commit before it). The 17 red were those of 4.2f's run but fire1938 (green now),
    and counters1938 and declutter1938, both by a test timeout (150 s, 300 s); the two alone
    passed (3 tests, 3.9 min). The specs were not changed.
  - PLAN 4.4b's gate (2026-10-10, this container): the ten-year run of seed 2 timed out too
    (737 s against 600; seed 1 924 s), and `economy.test.ts`'s year (120 s) and
    `territory.test.ts`'s cost in a unit stage that ran beside a ten-year stage left over
    from an aborted gate. The two unit files alone: 24 of 24. A year of seed 99 profiled on
    the commit and on the one before: each system within the run-to-run spread (combat 3.42
    and 3.69 ms, the commit before the slower). The tests were not changed.
  - PLAN 4.4's tick (2026-10-10, this container): the browser suite 164 of 165 in its job's
    two hours (zoomDemo, red on the commits before, not reached); red as before but for
    editorDrag1938 (a timeout, green alone) and declutter1938 (red once alone, then green alone
    on this commit and the one before). The ten-year stage: all three seeds through their ten
    years with no rule broken, seeds 1 and 3 over the 600 s (719 and 731 s).

## 2026-10-22 — PLAN 7.90g waits on PLAN 7.91 (a deploy test on a new history)

- **What:** 7.90g's rule (a formation ordered on a named transport group goes on it or is refused,
  ADR-649) meets its AT (`docs/evidence/7.90/g.md`), but with it `deploy.test.ts`'s day-60 share of
  formations in one view with their enemy is 0.887 against 0.9 (HEAD 0.986). Every failing pair is a
  Chinese block stacked against a Japanese formation: a deploy layout case, one of which HEAD has too.
- **Tried:** read the pairs (`tools/diag/deployView.ts`); `deployOf` is not a bounded change for the
  ferry's commit. The test is not narrowed.
- **Left:** PLAN 7.91 mends the deploy case; then `git apply docs/evidence/7.90/g.patch` and commit
  7.90g. No user decision waits.
- **2026-10-22:** 7.91's rule mends it (g.patch + rule: 72 of 75, 0.96) but is held itself, on PLAN 7.92
  (entry below). The order is now 7.92, 7.91, 7.90g; g.patch's DECISIONS and pin hunks will not apply
  after 7.91 (apply its `src/` and `tests/unit/` parts, the rest by hand, its pin read again).

## 2026-10-22 — PLAN 7.91 waits on PLAN 7.92 (a nuclear test on a new history)

- **What:** 7.91's rule (a stack counts its lines and files with those from its own side, ADR-650)
  meets its AT (`docs/evidence/7.91/case.md`): `deploy.test.ts` green on HEAD (96 of 99) and with
  7.90g's patch (72 of 75), its unit test red without. The whole unit suite with it: 1870 of 1871.
  `nukePoland1938.test.ts` seed 5591 red: Poland's first burst falls on an Italian army on the Alps
  front (64,445 men, u 0.027, day 21) where HEAD's fell on a German city (9,924 men, 334,000 people,
  u 0.081, day 23). On HEAD too the Italian army is Poland's best place on days 12–21: a weighing
  cause (a place's theatre is the enemy's men within 1,000 km of it, and here takes in the German
  army in Poland, so ADR-492's floor never binds), not the deploy's.
- **Tried:** read both rules' decisions (`tools/diag/nukePoland5591.ts`, `nukeCase.ts`). No deploy
  variant tried to move the seed: that would take the luck, not the cause. The test is not narrowed.
- **Left:** PLAN 7.92; then `git apply docs/evidence/7.91/patch`, its pin read again, and 7.91
  committed. No user decision waits on 7.91 itself; 7.92's may (its AT).

## RESOLVED 2026-10-23 (option a, the user's decision: the rule committed, 7.97 closed not done, PLAN 7.98 for the lift) · PLAN 7.97's AT missed: American piles 18 → 12, bar 4 (ADR-662)

- **Bar:** on 821–830 × 20 years American piles of 30+ held 30 days at most 4, engaged per war not below
  0.477 (`docs/evidence/7.97/at.md`).
- **What moved:** the cause read was the transports away from the army (822: the landing's group at
  Pearl Harbor, 32–36 divisions at Washington; 825: 14 groups refusing at Tallinn, Bizerte, Djibouti).
  The rule (`docs/evidence/7.97/patch`: a group with no order sails for the land and cell of most of the
  free army) moved the piles 18 → 12 and engaged per war 0.477 → 0.480.
- **Left:** the lift's size (827: 69 at Nome, a port, two groups, both acting; `wantsFerry` keeps one
  transport group in training at a time). ADR-662: (a) commit the rule + PLAN 7.98 for the lift
  (recommended), (b) commit the rule, no task, (c) drop it. The code is restored; the pin unchanged.
