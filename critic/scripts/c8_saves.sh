#!/bin/sh
# Critic run 8: saves taken the year before an AI nuclear exchange (seed 1 year 14, seed 6271 year 23).
cd /c/Git/WarSim
npx tsx critic/scripts/c8_headless.ts 1 13 critic/c8_pre_q1.json 13 critic/c8_seed1_y13.bin > critic/c8_pre_q1.log 2>&1 &
npx tsx critic/scripts/c8_headless.ts 6271 22 critic/c8_pre_6271.json 22 critic/c8_seed6271_y22.bin > critic/c8_pre_6271.log 2>&1 &
wait
