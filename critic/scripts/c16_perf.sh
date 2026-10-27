#!/bin/sh
# Critic run 16: pinned (--affinity 0xFFFF), alone, one at a time, after the batch and checkpoint reads:
# seed 99 x 5 years on HEAD and 7739a78; the builder's own cases (run 15's saves: 6421 year 28 from c15_seed6421_y27,
# 1129 year 21 from c15_seed1129_y20), each twice; HEAD's own 6421 and 1129 late years from HEAD's year-20 saves.
cd /c/Git/WarSim
until [ -f critic/c16_ck.done ]; do sleep 20; done
P="--affinity 0xFFFF"
npm run sim -- --scenario 1938 --seed 99 --years 5 $P > critic/c16_perf_seed99_5y_head.log 2>&1
(cd critic/wt && npm run sim -- --scenario 1938 --seed 99 --years 5 $P > /c/Git/WarSim/critic/c16_perf_seed99_5y_7739a78.log 2>&1)
for i in 1 2; do
npm run sim -- --scenario 1938 --seed 6421 --load critic/c15_seed6421_y27.bin --years 1 --profile $P > critic/c16_perf_6421c15_y28_read$i.log 2>&1
npm run sim -- --scenario 1938 --seed 1129 --load critic/c15_seed1129_y20.bin --years 1 --profile $P > critic/c16_perf_1129c15_y21_read$i.log 2>&1
done
npm run sim -- --scenario 1938 --seed 6421 --load critic/c16_seed6421_y20.bin --years 10 --profile $P > critic/c16_perf_6421_y21_30_head.log 2>&1
npm run sim -- --scenario 1938 --seed 1129 --load critic/c16_seed1129_y20.bin --years 10 --profile $P > critic/c16_perf_1129_y21_30_head.log 2>&1
echo done > critic/c16_perf1.done
