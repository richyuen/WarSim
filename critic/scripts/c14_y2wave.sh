#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c14_y2_latewar.mjs 4877 critic/c14_seed4877_y20.bin y20 > critic/c14_y2_4877_y20.log 2>&1 &
node critic/scripts/c14_y2_latewar.mjs 7019 critic/c14_seed7019_y20.bin y20 > critic/c14_y2_7019_y20.log 2>&1 &
wait
node critic/scripts/c14_y2_latewar.mjs 1129 critic/c14_seed1129_y10.bin y10 > critic/c14_y2_1129_y10.log 2>&1 &
node critic/scripts/c14_y2_latewar.mjs 6421 critic/c14_seed6421_y20.bin y20 > critic/c14_y2_6421_y20.log 2>&1 &
wait
echo done > critic/c14_y2.done
