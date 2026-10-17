# PLAN 7.7: the invasion AI late in the game (critic R7-B2)

Seed 3371, `npm run sim -- --scenario 1938 --seed 3371 --load <save> --affinity 0xFFFF --profile`.

## From the critic's year-27 save (`critic/c7_seed3371_y27.bin`), before and after

```
year  28  tick 245280  hash 93f36a51  nations 72  formations 1405  flipped 2396  tick ms mean 4.9133 p95 1.5921  (43.10 s)
  invasionAi     4.1688 ms   84.9 %  max   738.3  slow    54 calls 4.1659 ms
year  29  tick 254040  hash 935f0442  nations 72  formations 1449  flipped 0  tick ms mean 4.6110 p95 1.1498  (40.43 s)
  invasionAi     4.0099 ms   87.0 %  max   747.0  slow    52 calls 4.0076 ms
--- after
year  28  tick 245280  hash 93f36a51  nations 72  formations 1405  flipped 2396  tick ms mean 0.7468 p95 1.5323  (6.60 s)
  invasionAi     0.0207 ms    2.8 %  max    14.0  slow    54 calls 0.0180 ms
year  29  tick 254040  hash 935f0442  nations 72  formations 1449  flipped 0  tick ms mean 0.6035 p95 1.1181  (5.33 s)
  invasionAi     0.0176 ms    2.9 %  max     2.8  slow    53 calls 0.0153 ms
```

## From the critic's year-14 save, after (years 15 to 30)

```
year  15  tick 131400  hash 4201163d  nations 79  formations 1070  flipped 51329  tick ms mean 1.6886 p95 6.47
year  16  tick 140160  hash c5ad8d13  nations 75  formations 1088  flipped 92872  tick ms mean 1.3841 p95 5.71
year  17  tick 148920  hash 02900d83  nations 76  formations 1035  flipped 39644  tick ms mean 1.3775 p95 5.60
year  18  tick 157680  hash 3b114634  nations 76  formations 1051  flipped 57904  tick ms mean 1.3106 p95 4.81
year  19  tick 166440  hash 8a5daafd  nations 76  formations 1090  flipped 54923  tick ms mean 1.7338 p95 8.75
year  20  tick 175200  hash ad5bb810  nations 78  formations 1135  flipped 60208  tick ms mean 1.5165 p95 7.73
year  21  tick 183960  hash fdc25c15  nations 78  formations 1185  flipped 39522  tick ms mean 1.2741 p95 4.32
year  22  tick 192720  hash 1d24a812  nations 77  formations 1220  flipped 43263  tick ms mean 1.0051 p95 3.25
year  23  tick 201480  hash 1e573ecd  nations 75  formations 1252  flipped 28144  tick ms mean 0.5852 p95 1.45
year  24  tick 210240  hash a24ba385  nations 73  formations 1291  flipped 3824  tick ms mean 0.5375 p95 1.433
year  25  tick 219000  hash 4b12da26  nations 72  formations 1334  flipped 1091  tick ms mean 0.5390 p95 1.690
year  26  tick 227760  hash 3701756d  nations 72  formations 1378  flipped 2003  tick ms mean 0.7954 p95 1.690
year  27  tick 236520  hash bd1f4b47  nations 72  formations 1423  flipped 2591  tick ms mean 0.8463 p95 1.894
year  28  tick 245280  hash 1d1c71c6  nations 72  formations 1434  flipped 2478  tick ms mean 0.5217 p95 1.437
year  29  tick 254040  hash 3a423be3  nations 72  formations 1491  flipped 1521  tick ms mean 0.3973 p95 1.256
year  30  tick 262800  hash 23859e13  nations 72  formations 1505  flipped 1600  tick ms mean 0.7123 p95 2.318
done: 16 years, 142.8 s wall, mean tick 1.0140 ms, final hash 23859e13 → .cache/runs/1938-seed3371-16y.json
```

The longest `invasionAi` call of the 16 years: 14.8 ms.
