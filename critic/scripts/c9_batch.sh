#!/bin/sh
# Critic run 9: 30-year unaided worlds on unseen seeds, side by side (not for timing).
cd /c/Git/WarSim
for s in 1129 2251 3407 4483 5527 6653 7741 8821 9901 1471 2609 3793 4957 6113; do
  npx tsx critic/scripts/c9_headless.ts $s 30 critic/c9_headless_$s.json 20 critic/c9_seed${s}_y20.bin > critic/c9_headless_$s.log 2>&1 &
done
wait
echo ALLDONE > critic/c9_batch.done
