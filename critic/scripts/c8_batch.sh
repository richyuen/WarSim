#!/bin/sh
# Critic run 8: 30-year unaided worlds, side by side (not for timing).
cd /c/Git/WarSim
for s in 1 2 3 4 5 6 7 8 9 10; do
  npx tsx critic/scripts/c8_headless.ts $s 30 critic/c8_headless_q$s.json > critic/c8_headless_q$s.log 2>&1 &
done
for s in 4093 6271 7919 2843 5381 9137; do
  npx tsx critic/scripts/c8_headless.ts $s 30 critic/c8_headless_$s.json > critic/c8_headless_$s.log 2>&1 &
done
npx tsx critic/scripts/c8_headless.ts 3371 30 critic/c8_headless_3371.json 14 critic/c8_seed3371_y14.bin > critic/c8_headless_3371.log 2>&1 &
wait
echo ALLDONE > critic/c8_batch.done
