#!/bin/sh
# Critic run 15: page timing, one build at a time, after the pinned runs: 4877 years 21-23 at Max and 10 years of 3301
# at Max on HEAD (5316) and 311988d (5317, each loading its own commit's year-20 save); 8167's year 19 at Max on HEAD.
cd /c/Git/WarSim
until [ -f critic/c15_perf1.done ]; do sleep 20; done
node critic/scripts/c15_l_lategame.mjs 4877 critic/c15_seed4877_y20.bin 3 > critic/c15_l_4877.log 2>&1
node critic/scripts/c15o_l_lategame.mjs 4877 critic/c14_seed4877_y20.bin 3 > critic/c15o_l_4877.log 2>&1
node critic/scripts/c15_w_decade.mjs 3301 10 > critic/c15_w_3301.log 2>&1
node critic/scripts/c15o_w_decade.mjs 3301 10 > critic/c15o_w_3301.log 2>&1
node critic/scripts/c15_l_lategame.mjs 8167 critic/c15_seed8167_y18.bin 1 > critic/c15_l_8167.log 2>&1
echo done > critic/c15_pagetime.done
