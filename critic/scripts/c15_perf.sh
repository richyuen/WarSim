#!/bin/sh
# Critic run 15: pinned, alone, one at a time, after every batch: seed 99 x 5 years on HEAD and 311988d; HEAD's slowest
# batch world-years re-read from HEAD's own saves; run 14's 8167 years 11-20 and 4877 year 21 on HEAD's saves.
cd /c/Git/WarSim
until [ -f critic/c15_ck.done ]; do sleep 20; done
P="--affinity 0xFFFF"
npm run sim -- --scenario 1938 --seed 99 --years 5 $P > critic/c15_perf_seed99_5y_head.log 2>&1
(cd critic/wt && npm run sim -- --scenario 1938 --seed 99 --years 5 $P > /c/Git/WarSim/critic/c15_perf_seed99_5y_311988d.log 2>&1)
npm run sim -- --scenario 1938 --seed 6421 --load critic/c15_seed6421_y20.bin --years 10 --profile $P > critic/c15_perf_6421_y21_30_head.log 2>&1
npm run sim -- --scenario 1938 --seed 1129 --load critic/c15_seed1129_y10.bin --years 11 --profile $P > critic/c15_perf_1129_y11_21_head.log 2>&1
npm run sim -- --scenario 1938 --seed 8167 --load critic/c15_seed8167_y10.bin --years 10 --profile $P > critic/c15_perf_8167_y11_20_head.log 2>&1
npm run sim -- --scenario 1938 --seed 4877 --load critic/c15_seed4877_y20.bin --years 1 --profile $P > critic/c15_perf_4877_y21_head.log 2>&1
echo done > critic/c15_perf1.done
