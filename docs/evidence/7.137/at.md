# PLAN 7.137's AT: carriers on 1191–1200 × 20 years

2026-10-26. HEAD `aeeb7a00` (no carrier ordered) against `de59f92d` (ADR-725: a carrier group delivered with its air
groups; ADR-726: a battle fleet's nation keeps 4 carriers afloat). `tools/diag/seaYears.ts` (now with carriers afloat,
manned and in training at each year's end), five at a time; files in `.cache/7137/head` and `.cache/7137/rule`.
1181–1190 skipped: 1187 is a critic seed.

| seed | 1191 | 1192 | 1193 | 1194 | 1195 | 1196 | 1197 | 1198 | 1199 | 1200 | mean |
|---|---|---|---|---|---|---|---|---|---|---|---|
| manned carriers y20, HEAD | 6 | 0 | 6 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | **1.8** |
| manned carriers y20, rule | 6 | 0 | 6 | 2 | 4 | 4 | 4 | 0 | 3 | 4 | **3.3** |
| sea battles a year, years 2–20, HEAD | 11.2 | 7.2 | 9.9 | 9.3 | 7.5 | 6.9 | 7.9 | 9.4 | 10.6 | 6.7 | **8.66** |
| the same, rule | 11.6 | 7.2 | 9.9 | 8.8 | 7.7 | 7.5 | 7.9 | 7.1 | 10.4 | 5.8 | **8.40** |

Year 1's battles 49.9 in both (no carrier ordered in year 1). Battles that sank nothing 3.0 % → 2.6 %.

- Carriers **3.3** (bar 6): missed. Every carrier afloat at year 20 has its wing aboard (ADR-725).
- Sea battles late **0.97 ×** (bar: not below HEAD's): missed by 0.26 a world-year, within the seeds' spread.

The rule builds where HEAD's worlds had none (1194–1197, 1200: 0 → 2–4), but 1192 and 1198 end with none: a carrier
group is 4,172 gold and 800 days, and a navy holds one fleet in training at a time. Seeds 1191–1200 spent; the next
tasks 1201 on (1207, 1213 are critic seeds).
