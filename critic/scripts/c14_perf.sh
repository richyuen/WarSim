#!/bin/sh
# Critic run 14: pinned, alone, one at a time: seed 99 x 5 years and year 21 of 4877 (own y20 saves) on HEAD and
# 0c80db1 (critic/wt); 8167 from its y10 save (years 11-20, incl. its slow year 19) and from y20 (21-23) on HEAD.
cd /c/Git/WarSim
until [ -f critic/c14_ck.done ]; do sleep 20; done
npm run sim -- --scenario 1938 --seed 99 --years 5 --affinity 0xFFFF > critic/c14_perf_seed99_5y_head.log 2>&1
(cd critic/wt && npm run sim -- --scenario 1938 --seed 99 --years 5 --affinity 0xFFFF > /c/Git/WarSim/critic/c14_perf_seed99_5y_0c80db1.log 2>&1)
npm run sim -- --scenario 1938 --seed 4877 --load critic/c14_seed4877_y20.bin --years 1 --profile --affinity 0xFFFF > critic/c14_perf_4877_y21_head.log 2>&1
(cd critic/wt && npm run sim -- --scenario 1938 --seed 4877 --load /c/Git/WarSim/critic/c13_seed4877_y20.bin --years 1 --profile --affinity 0xFFFF > /c/Git/WarSim/critic/c14_perf_4877_y21_0c80db1.log 2>&1)
npm run sim -- --scenario 1938 --seed 8167 --load critic/c14_seed8167_y20.bin --years 3 --profile --affinity 0xFFFF > critic/c14_perf_8167_y21_23_head.log 2>&1
npm run sim -- --scenario 1938 --seed 8167 --load critic/c14_seed8167_y10.bin --years 10 --affinity 0xFFFF > critic/c14_perf_8167_y11_20_head.log 2>&1
echo done > critic/c14_perf.done
