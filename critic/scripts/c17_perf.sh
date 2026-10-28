#!/bin/sh
# Critic run 17: after the batch. HEAD's slowest contended world-years (and the builder's 3847 y27 / 5683 y26 on HEAD's
# own worlds) stepped to the year's start from HEAD's saves; then pinned (--affinity 0xFFFF), alone, twice each;
# seed 99 x 5 years on HEAD and 7b883084.
cd /c/Git/WarSim
ck() { npx tsx critic/scripts/c17_ck.ts $1 critic/c17_seed$1_y$2.bin $3 critic/c17_seed$1_y$(($3-1)).bin > critic/c17_ck_$1_$3.log 2>&1; }
ck 9781 20 24 & ck 8011 10 19 & ck 7019 10 15 & ck 7129 20 28 & ck 4493 10 14 & ck 3847 20 27 & ck 5683 20 26 & wait
P="--affinity 0xFFFF"
npm run sim -- --scenario 1938 --seed 99 --years 5 $P > critic/c17_perf_seed99_5y_head.log 2>&1
(cd critic/wt && npm run sim -- --scenario 1938 --seed 99 --years 5 $P > /c/Git/WarSim/critic/c17_perf_seed99_5y_7b88.log 2>&1)
for i in 1 2; do
for sy in 9781:24 8011:19 7019:15 7129:28 4493:14 3847:27 5683:26; do s=${sy%:*}; y=${sy#*:};
npm run sim -- --scenario 1938 --seed $s --load critic/c17_seed${s}_y$((y-1)).bin --years 1 --profile $P > critic/c17_perf_${s}_y${y}_read$i.log 2>&1
done; done
echo done > critic/c17_perf.done
