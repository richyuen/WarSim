#!/bin/sh
# Critic run 15: second reads of the budget breaches, pinned and alone: 6421 year 28 (from HEAD's own year-27 save) and
# 1129 year 21 (from its year-20 save), each twice; then 6421's year 28 in the page at Max.
cd /c/Git/WarSim
P="--affinity 0xFFFF"
npx tsx critic/scripts/c15_ck.ts 6421 critic/c15_seed6421_y20.bin 28 critic/c15_seed6421_y27.bin > critic/c15_ck_6421_y27.log 2>&1
for i in 1 2; do
npm run sim -- --scenario 1938 --seed 6421 --load critic/c15_seed6421_y27.bin --years 1 --profile $P > critic/c15_perf_6421_y28_read$i.log 2>&1
npm run sim -- --scenario 1938 --seed 1129 --load critic/c15_seed1129_y20.bin --years 1 --profile $P > critic/c15_perf_1129_y21_read$i.log 2>&1
done
node critic/scripts/c15_l_lategame.mjs 6421 critic/c15_seed6421_y27.bin 1 > critic/c15_l_6421.log 2>&1
echo done > critic/c15_perf2.done
