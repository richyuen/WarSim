#!/bin/sh
# Critic run 8: pinned tick measurements, alone.
cd /c/Git/WarSim
npm run sim -- --scenario 1938 --seed 99 --years 5 --affinity 0xFFFF > critic/c8_perf_seed99_5y_solo.log 2>&1
npm run sim -- --scenario 1938 --seed 3371 --load critic/c8_seed3371_y14.bin --years 16 --affinity 0xFFFF --profile > critic/c8_perf_3371_y15_30_solo.log 2>&1
npm run sim -- --scenario 1938 --seed 2843 --years 30 --affinity 0xFFFF --profile > critic/c8_perf_2843_30y_solo.log 2>&1
echo done > critic/c8_perf.done
