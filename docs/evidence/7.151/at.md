# PLAN 7.151 — the AT: carriers' decks re-manned (ADR-746)

Run: `tools/diag/carrierAt.ts <seed> 20` on seeds 1411–1420, from 1938, HEAD `d45da86b` (a worktree) against the
rule (the working tree, `economicAi` 3c0). Figures a world. `manned`: carriers afloat with a wing aboard at the year's
end; `cvAirH`: hours with a carrier wing's strike in the air, in a sea battle or on its own mission (PLAN 7.145's
figure, the critic's "carrier air hours"; the AT's strike-hours); `strikeH`: hours with a sea-battle carrier strike in
the air, beside it.

```
seed | manned y20 H/R | carriers y20 H/R | manned y10 H/R | cvAirH y2-20 H/R | strikeH y2-20 H/R | battles y2-20 H/R | sunk H/R | transports y20 H/R | warships y20 H/R
1411 | 2/2 | 2/2 | 0/2 | 21316/22824 | 23/494 | 133/135 | 1541/1379 | 596/621 | 409/201
1412 | 0/8 | 6/8 | 0/10 | 9144/85619 | 230/464 | 157/170 | 1816/1748 | 575/539 | 347/130
1413 | 0/5 | 4/5 | 0/6 | 8342/35501 | 68/901 | 115/144 | 1195/1704 | 854/379 | 320/54
1414 | 0/3 | 4/3 | 2/6 | 15218/49953 | 96/295 | 165/127 | 1918/1623 | 861/325 | 176/273
1415 | 0/0 | 2/0 | 2/0 | 13829/28897 | 24/142 | 159/133 | 1527/1613 | 394/399 | 292/232
1416 | 0/4 | 6/4 | 0/4 | 32033/54494 | 1574/936 | 129/161 | 1712/2058 | 512/690 | 295/220
1417 | 0/2 | 5/2 | 5/4 | 36262/38337 | 705/196 | 151/122 | 1646/1497 | 502/675 | 244/281
1418 | 2/4 | 3/4 | 0/0 | 28285/41319 | 497/499 | 166/139 | 2124/1877 | 635/564 | 175/188
1419 | 0/4 | 0/4 | 2/2 | 9158/34103 | 430/468 | 156/143 | 1769/1645 | 805/542 | 96/239
1420 | 2/5 | 4/5 | 2/5 | 36228/79573 | 55/1185 | 138/177 | 1554/1887 | 553/401 | 455/336
m20: HEAD 0.60 rule 3.70 a world, ratio 6.167
c20: HEAD 3.60 rule 3.70 a world, ratio 1.028
m10: HEAD 1.30 rule 3.90 a world, ratio 3.000
air: HEAD 20981.50 rule 47062.00 a world, ratio 2.243
str: HEAD 370.20 rule 558.00 a world, ratio 1.507
bat: HEAD 146.90 rule 145.10 a world, ratio 0.988
sunk: HEAD 1680.20 rule 1703.10 a world, ratio 1.014
tr: HEAD 628.70 rule 513.50 a world, ratio 0.817
war: HEAD 280.90 rule 215.40 a world, ratio 0.767
```

- Carriers with a wing aboard at year 20: 0.60 → 3.70 a world (**6.2 ×**; bar 2 × and at least 2.5): **met**.
  Year 10 1.30 → 3.90.
- Carrier strike-hours years 2–20 (`cvAirH`): 20,982 → 47,062 (**2.24 ×**; bar not below 0.9 ×): **met**. `strikeH`
  370 → 558.
- The panel: `tests/e2e/carrierDeck1938.spec.ts`, `a-carrier-panel-99.png` (a Japanese carrier group of seed 99, two
  naval bomber groups aboard, both striking).
- Unit test: `tests/unit/deckRefit1938.test.ts`, red without the rule.
- Beside the AT (no bar here): sea battles 0.99 ×, ships sunk in them 1.01 ×; transports at year 20 0.82 × (lower on
  6 of 10) and armed ships afloat at year 20 0.77 × (lower on 6 of 10). The decks' wings take gold that went to the
  navy and the army: one more cost on PLAN 7.154's figures (its AT reads transports at year 20 against its own HEAD).

The read before (`tools/diag/deckLoss.ts`, critic run 17's year-10 saves of 4493, 3727, 6301 stepped on HEAD's code):
deck wings go in the air (4493: 1 in year 1, 3 in year 3) and with their carrier sunk (1), and none comes back; 6301's
two carriers already empty at year 10.
