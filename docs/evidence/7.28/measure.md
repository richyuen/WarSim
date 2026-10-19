# PLAN 7.28: a launch shot down and the gap after it (measure)

The gap (ADR-507, PLAN 7.25b): a side that launched in a war weighs no first use in it for
STRIKE_GAP_DAYS 7, keyed on the launch (`War.lastStrike`, set at the decision), so a warhead shot
down holds the side as a burst does. ADR-491 promised that a holder under the enemy's air launches
again the next day after an interception.

## 1. Seeds 1–10 × 30 years (`2ea87fe`'s sim)

`tools/diag/nukeGates.ts <seed> 30`, its `paused` split by what became of the launch that began the
gap (`pausedBy`: burst; stopped short, shot down or its bomber lost on the way; still in flight),
each held war-day weighed as if it were not (its category; "a strike otherwise" = `strike`, above
the floor and in reach); and the gaps begun by a launch stopped short (`shortGaps`). Summary
`.cache/r728/sum.mjs`, runs `.cache/r728/before_<seed>.json`.

| Seed | Decisions | Launches | Stopped short | Bursts | First burst, year | Span of bursts, days | All within 2 days | Held war-days | after a burst (a strike otherwise) | after a launch stopped short (a strike otherwise) | in flight (a strike otherwise) | Gaps after a launch stopped short | of them with a day that would strike | of them never followed by a launch in the war |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 19 | 19 | 0 | 19 | 25.9 | 1182 |  | 80 | 80 (26) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 2 | 12 | 12 | 6 | 6 | 10.0 | 48 |  | 54 | 30 (24) | 24 (24) | 0 (0) | 4 | 4 | 0 |
| 3 | 13 | 13 | 0 | 13 | 8.7 | 7324 |  | 39 | 39 (7) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 4 | 1 | 1 | 0 | 1 | 21.3 | 0 |  | 2 | 2 (0) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 5 | 76 | 76 | 0 | 76 | 12.7 | 2982 |  | 492 | 492 (94) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 6 | 0 | 0 | 0 | 0 |  |  |  | 0 | 0 (0) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 7 | 9 | 9 | 0 | 9 | 13.3 | 6085 |  | 56 | 56 (0) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 8 | 31 | 31 | 0 | 31 | 13.4 | 5222 |  | 109 | 109 (64) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 9 | 2 | 2 | 0 | 2 | 13.6 | 3402 |  | 3 | 3 (0) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 10 | 5 | 5 | 0 | 5 | 10.2 | 4200 |  | 20 | 20 (0) | 0 (0) | 0 (0) | 0 | 0 | 0 |

- 168 launches, 162 bursts, 6 stopped short, all on seed 2: Nationalist Spain (NSP) in war 102
  against Britain. Its first uses on days 3606, 3613, 3620, 3627 and 3634 (year 9.9), at utilities
  0.025 to 0.03, one a week, each the day the gap let it, all five shot down; Britain struck on day
  3635, and Spain's strike back on 3636 (0.417) was shot down too. Every one of the 24 war-days held
  after its first four would have been a strike (each gap: 6 of 6 days); the fifth's gap was cut by
  Britain's burst (a strike back is not held).
- After a burst, 215 of 855 held war-days would have been strikes: what the gap is for (ADR-507).
- No held day after a launch still in flight: a bomber's flight is hours, the day's weigh after it.
- In these worlds the gap after a launch shot down is rare (one nation, one war, 24 war-days), since
  the AI's holders mostly strike by missile or where their side holds the air.

## 2. The critic's set-ups (`tools/diag/nukeGap.ts`)

France (seed 7127, 10 warheads, Germany's war on it, 100 days; `nukeOverrun1938.test.ts`) and
Poland (10 warheads and a strategic group at Warsaw, 120 days; `nukePoland1938.test.ts`). Logs
`.cache/r728/probe_<nation>_<seed>.log`.

| Set-up | Launches | Stopped short | Bursts | First burst, day | Held days after a burst (a strike otherwise) | after a launch stopped short (a strike otherwise) |
|---|---|---|---|---|---|---|
| France 7127 | 2 | 1 | 1 | 53 | 6 (0) | 6 (6) |
| Poland 5591 | 4 | 2 | 2 | 54 | 12 (0) | 12 (12) |
| Poland 7127 | 5 | 4 | 1 | 62 | 6 (6) | 24 (19) |
| Poland 3929 | 3 | 2 | 1 | 72 | 6 (6) | 12 (6) |

- France's first launch (day 46) is shot down by German fighters; it would strike on each of the
  next 6 days and is held to day 53. On this build its bomber lives to day 59; on 7.26b's (ADR-508)
  the bomber was lost within the week with 9 warheads unused, the case that opened this task.
- Of 54 days held after a launch stopped short, 43 would have been strikes. Each bomber's last
  attempts end with the bomber lost (France day 59, Poland days 81–84) and 4 to 8 warheads unused.

## Reading

The gap waits for what a burst brings: the shock on the enemy's exhaustion (NUKE_SHOCK), an answer,
a peace (ADR-507's "Why 7 days"). A launch stopped short brings none of them, and holds the side as
long as a burst. In the ordinary worlds it is rare; in the critic's set-ups, a holder under the
enemy's air, it is the common case, and the week it costs is the bomber's life. The rule (§3): a
launch stopped short starts no gap.

## 3. The rule: a launch stopped short starts no gap (ADR-522)

`War.strikesLive` counts a side's launches of its last strike's tick (an ally's of the same hour add
to them); a launch stopped short (`arrivals`: shot down, or its bomber lost on the way) takes one
off in each war whose side's last strike it was (`strikeStopped`). `strikePaused` holds the side
only while one is left. The resolve's gap (RESOLVE_GAP_DAYS, `resolveOf`) still reads
`War.lastStrike` alone.

### Seeds 1–10 × 30 years with the rule (`.cache/r728/after_<seed>.json`)

| Seed | Decisions | Launches | Stopped short | Bursts | First burst, year | Span of bursts, days | All within 2 days | Held war-days | after a burst (a strike otherwise) | after a launch stopped short (a strike otherwise) | in flight (a strike otherwise) | Gaps after a launch stopped short | of them with a day that would strike | of them never followed by a launch in the war |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 19 | 19 | 0 | 19 | 25.9 | 1182 |  | 80 | 80 (26) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 2 | 24 | 24 | 6 | 18 | 9.9 | 6086 |  | 87 | 87 (6) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 3 | 13 | 13 | 0 | 13 | 8.7 | 7324 |  | 39 | 39 (7) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 4 | 1 | 1 | 0 | 1 | 21.3 | 0 |  | 2 | 2 (0) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 5 | 76 | 76 | 0 | 76 | 12.7 | 2982 |  | 492 | 492 (94) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 6 | 0 | 0 | 0 | 0 |  |  |  | 0 | 0 (0) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 7 | 9 | 9 | 0 | 9 | 13.3 | 6085 |  | 56 | 56 (0) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 8 | 31 | 31 | 0 | 31 | 13.4 | 5222 |  | 109 | 109 (64) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 9 | 2 | 2 | 0 | 2 | 13.6 | 3402 |  | 3 | 3 (0) | 0 (0) | 0 (0) | 0 | 0 | 0 |
| 10 | 5 | 5 | 0 | 5 | 10.2 | 4200 |  | 20 | 20 (0) | 0 (0) | 0 (0) | 0 | 0 | 0 |

- Seeds 1 and 3–10: no launch stopped short, so the rule never fires: the same decisions, bursts and held days. Seed 2: Spain's first uses
  on days 3606 to 3610, one a day, each shot down (before: one a week, 3606 to 3634); Britain's
  answer comes on day 3611 (3635 before), and from there the world parts: 18 bursts (6), all
  Britain's but one of Sweden's, over 16.7 years.
- Held war-days after a launch stopped short: 0 (24). No world's bursts all within 2 days: a run
  of launches shot down day after day is not a spasm of bursts (PLAN 7.25b's AT).

### The critic's set-ups with the rule (`.cache/r728/after_probe_<nation>_<seed>.log`)

| Set-up | Launches | Stopped short | Bursts | Burst days (before) | Warheads left (before) |
|---|---|---|---|---|---|
| France 7127 | 2 | 1 | 1 | 47 (53) | 8 (8) |
| Poland 5591 | 4 | 2 | 2 | 54, 66 (54, 78) | 6 (6) |
| Poland 7127 | 6 | 4 | 2 | 56, 66 (62) | 4 (5) |
| Poland 3929 | 5 | 3 | 2 | 68, 77 (72) | 5 (7) |

- France: shot down on day 46, it launches the next day and bursts on Germany on day 47.
- Poland: a burst sooner on each seed, a second where there was none on 7127 and 3929.
