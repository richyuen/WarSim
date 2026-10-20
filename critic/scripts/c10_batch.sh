#!/bin/sh
# Critic run 10: 30-year unaided worlds on unseen seeds, side by side (not for timing).
cd /c/Git/WarSim
for s in 1307 2081 2953 3613 4219 4877 5309 5861 6421 7019 7583 8167 8693 9437; do
  npx tsx critic/scripts/c10_headless.ts $s 30 critic/c10_headless_$s.json 20 critic/c10_seed${s}_y20.bin > critic/c10_headless_$s.log 2>&1 &
done
wait
echo ALLDONE > critic/c10_batch.done
