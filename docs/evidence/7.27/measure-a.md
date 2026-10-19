# PLAN 7.27a — which five hold, and what wars they are in

2026-10-19, code of `6a877ca` (pin c3bd280a). PLAN 7.27 asked first for a second sweep on unseen
seeds, then, if it failed, the measure: which five hold, from which year, and what wars they are in.

## The second sweep: short

`npm run sweep -- --first 731 --tag 727a`, seeds 731–740 × 50 years
(`docs/sweeps/2026-10-19-sweep-727a.md`): limits 10 of 10, riser 10, faller 10, no break-up 10,
**no stasis 7 of 10** (732: 24 years, 735: 21, 740: 21). Three unseen sweeps since 7.18g: 7 of 10
(701–710), 10 of 10 (721–730), 7 of 10 (731–740). Three sweeps on three codes (pins `58594a40` at
7.24a, `c3bd280a` here, with ADR-508, 510, 517 and 518 between), so luck and the 7.26 rules are not
separated; what the sweeps share is the fixed top below, in 7.18g's longest spans as in these, so
the air's calibration is not what decides stasis.

## The longest top five of each seed

The five largest by land, as a set, its longest unchanged span, wars a year and the share of the
land changing controller each year in that span (from the reports' yearly samples).

| Seed | Span | The five | Wars a year | Land moved a year |
|---|---|---|---|---|
| 731 | 38–50 (13) | SOV FRA ENG SIN USA | 0–5 | 0.6–4.1 % |
| **732** | **27–50 (24)** | **GER SOV ITA FRA USA** | **4–10** | **1.3–7.9 %** |
| 733 | 41–49 (9) | POL SOV ITA FRA USA | 2–5 | 0.1–1.6 % |
| 734 | 19–31 (13) | GER SOV NSP USA BRA | 1–6 | 0.5–4.4 % |
| **735** | **27–47 (21)** | **GER SOV ITA JAP USA** | **2–7** | **3.2–8.7 %** |
| 736 | 27–44 (18) | SOV FRA ENG SYR USA | 1–10 | 0.3–3.3 % |
| 737 | 8–23 (16) | SOV FRA AST CAN USA | 2–8 | 0.7–12.2 % |
| 738 | 36–46 (11) | ITA FRA AFG JAP USA | 1–8 | 1.2–4.0 % |
| 739 | 24–40 (17) | GER SOV ITA AST USA | 1–11 | 0.4–6.2 % |
| **740** | **20–40 (21)** | **POL SOV ITA USA BRA** | **3–6** | **0.5–6.7 %** |

The same on the earlier sweeps: the USA is in the longest five on 30 of 30 seeds (701–740), the
Soviet Union on 27 of 30. The failing seeds of 7.18g (702, 704, 706) held FRA ENG RAJ AST USA and
SOV FRA ENG RAJ USA twice, with 0–5 wars a year and 0.4–2.9 % of the land moving.

On 732, 735 and 740 the world is not still: 3–10 wars a year and up to 8.7 % of the land changing
hands. What does not change is the top.

## What the five are doing (`npm run diag`, `.cache/727/diag*.txt`)

Snapshots at the span's start and inside it (732: years 26, 27, 36, 46; 735: 26, 27, 37, 46; 740:
19, 20, 30, 40). The ratio is the diag's: the nation's strength with allies over the other's
defence, capped at 3.0.

- **The USA, every seed:** 15–18 M km² (11–13.5 %), aggression 15, 2.1–4.1 M men, a treasury of
  190,000–770,000 gold (income ~5,700, the next richest ~5,900 with 20,000 gold). Its wars are
  across the sea (ENG, ITA's 26-member side: score 0 after 98 and 192 days on 740) or with a
  Central American minor; at the ratio cap against Canada and Mexico, which it seldom takes. No
  one reaches it.
- **One alliance holds two or three places:** GER, ITA, POL and JAP share alliance 1 on all three
  seeds for the whole span; members never fight each other.
- **The Soviet Union, the place that could open:** 10–21 M km² held with 5,000–105,000 men and
  an income of 356–773, against Germany's 550,000–1.6 M men (aggression 90) and Japan's
  200,000–650,000, which see it at the ratio cap (3.0).
  - 732: GER v SOV 181 days old in year 26, score 35, exhaustion 18/29; by year 27 a truce,
    Soviet land 15.7 → 11.9 M km² (Germany 12.1 → 15.0). Then truces with GER, JAP and SIN in
    year 27; JAP v SOV 20 days in year 36; years 36–46 Soviet land 11.6 → 12.7 M (it regains).
  - 735: Soviet land 13.5 → 12.6 → 10.3 → 11.0 M km² over years 26–46 with 30,000 men; GER on a
    truce in year 37 at 1.6 M men; GER and JAP at war with it in year 46, its men 5,000.
  - 740: the Soviet Union is the largest, 21.0 → 16.6 M in year 19–20 while #114, POL, JAP and
    ENG fight it with 53,000–66,000 men of its own, then 3 wars in the world in years 30 and 40
    (JAP v SOV 73 days in year 40, score 1).
- The sixth is near: 732's AST 6.1 %, ARG 4.7 % against the fifth's 7.4 %. A fallen Soviet Union
  would let Japan, Poland or Brazil in.

## Reading

The stasis is not a quiet world but a fixed top: an unreachable USA, an alliance whose members do
not fight each other, and a Soviet Union that a 20-fold army at the ratio cap does not take for 20
years. Its wars with it end within the year with most of its land left and a truce after. Which
part of that stops it, the war's end (peace taken while winning, the truce after) or the front
(Germany's men not in contact over the Soviet land), is 7.27b's trace.

Whether this is the late land war short (PLAN 7.29's condition): not yet known. If 7.27b finds
the front stalls for want of men in contact, the late land war is short on land fronts, which
7.29a and b (lift by sea) do not cover: a new part of 7.29. If it finds the war ended by a
decision while winning, the cause is the strategic AI's and stays 7.27's.
