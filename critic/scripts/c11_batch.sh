#!/bin/sh
# Critic run 11: 30-year unaided worlds; run 10's 14 seeds (compare) + 10 new seeds. Side by side, not for timing.
cd /c/Git/WarSim
for s in 1307 2081 2953 3613 4219 4877 5309 5861 6421 7019 7583 8167 8693 9437 1129 2347 3491 4513 5683 6151 7247 8011 8849 9781; do
  npx tsx critic/scripts/c11_headless.ts $s 30 critic/c11_headless_$s.json 20 critic/c11_seed${s}_y20.bin > critic/c11_headless_$s.log 2>&1 &
done
wait
echo ALLDONE > critic/c11_batch.done
