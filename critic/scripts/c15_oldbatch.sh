#!/bin/sh
# Critic run 15: the 8 new seeds on 311988d (run 14's commit) in critic/wt, after HEAD's batch.
cd /c/Git/WarSim
until [ -f critic/c15_batch.done ]; do sleep 20; done
cd /c/Git/WarSim/critic/wt
run() { s=$1; npx tsx critic/scripts/c15_headless.ts $s 30 /c/Git/WarSim/critic/c15o_headless_$s.json 20 /c/Git/WarSim/critic/c15o_seed${s}_y20.bin > /c/Git/WarSim/critic/c15o_headless_$s.log 2>&1; }
for s in 1213 2633 3467 4789 5531 6659 7723 8861; do run $s & done; wait
echo ALLDONE > /c/Git/WarSim/critic/c15o_batch.done
