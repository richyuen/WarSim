#!/bin/sh
# Critic run 16: HEAD's four slowest batch world-years (contended over 5.5 ms) re-read pinned and alone from HEAD's own
# saves stepped to the year's start; then the page timings (c16_pagetime.sh).
cd /c/Git/WarSim
until [ -f critic/c16_perf1.done ]; do sleep 20; done
npx tsx critic/scripts/c16_ck.ts 5683 critic/c16_seed5683_y20.bin 26 critic/c16_seed5683_y25.bin > critic/c16_ck_5683.log 2>&1 &
npx tsx critic/scripts/c16_ck.ts 3847 critic/c16_seed3847_y20.bin 27 critic/c16_seed3847_y26.bin > critic/c16_ck_3847.log 2>&1 &
npx tsx critic/scripts/c16_ck.ts 9203 critic/c16_seed9203_y20.bin 29 critic/c16_seed9203_y28.bin > critic/c16_ck_9203.log 2>&1 &
npx tsx critic/scripts/c16_ck.ts 2633 critic/c16_seed2633_y20.bin 26 critic/c16_seed2633_y25.bin > critic/c16_ck_2633.log 2>&1 &
wait
P="--affinity 0xFFFF"
for i in 1 2; do
npm run sim -- --scenario 1938 --seed 5683 --load critic/c16_seed5683_y25.bin --years 1 --profile $P > critic/c16_perf_5683_y26_read$i.log 2>&1
npm run sim -- --scenario 1938 --seed 3847 --load critic/c16_seed3847_y26.bin --years 1 --profile $P > critic/c16_perf_3847_y27_read$i.log 2>&1
npm run sim -- --scenario 1938 --seed 9203 --load critic/c16_seed9203_y28.bin --years 1 --profile $P > critic/c16_perf_9203_y29_read$i.log 2>&1
npm run sim -- --scenario 1938 --seed 2633 --load critic/c16_seed2633_y25.bin --years 1 --profile $P > critic/c16_perf_2633_y26_read$i.log 2>&1
done
echo done > critic/c16_perf2.done
sh critic/scripts/c16_pagetime.sh
