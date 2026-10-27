#!/bin/sh
cd /c/Git/WarSim
for s in 1129 2081 6421 7019 4877 9437 1307 8167; do npx tsx critic/scripts/c16_cvworld.ts $s critic/c16_seed${s}_y20.bin 365 critic/c16_cvworld_$s.json > /dev/null 2>&1 & done; wait
cd critic/wt
for s in 1129 2081 6421 7019 4877 9437 1307 8167; do npx tsx critic/scripts/c16_cvworld.ts $s ../c15_seed${s}_y20.bin 365 ../c16o_cvworld_$s.json > /dev/null 2>&1 & done; wait
echo done > /c/Git/WarSim/critic/c16_cvbatch.done
