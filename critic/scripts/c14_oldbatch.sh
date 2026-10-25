#!/bin/sh
# Critic run 14: the 8 new seeds on 0c80db1 (run 13's commit) in critic/wt, after HEAD's batch.
cd /c/Git/WarSim
until [ -f critic/c14_batch.done ]; do sleep 20; done
cd /c/Git/WarSim/critic/wt
run() { s=$1; npx tsx critic/scripts/c14_headless.ts $s 30 /c/Git/WarSim/critic/c14o_headless_$s.json 20 /c/Git/WarSim/critic/c14o_seed${s}_y20.bin > /c/Git/WarSim/critic/c14o_headless_$s.log 2>&1; }
for s in 1187 2539 3359 4673 5651 6967 7411 8539; do run $s & done; wait
echo ALLDONE > /c/Git/WarSim/critic/c14o_batch.done
