#!/bin/sh
# Critic run 16: page timing, one build at a time, after the pinned runs. HEAD on 5326, 7739a78 on 5327.
cd /c/Git/WarSim
until [ -f critic/c16_perf2.done ]; do sleep 20; done
node critic/scripts/c16_l_lategame.mjs 6421 critic/c15_seed6421_y27.bin 1 > critic/c16_l_6421c15.log 2>&1
node critic/scripts/c16o_l_lategame.mjs 6421 critic/c15_seed6421_y27.bin 1 > critic/c16o_l_6421c15.log 2>&1
node critic/scripts/c16_l_lategame.mjs 4877 critic/c16_seed4877_y20.bin 3 > critic/c16_l_4877.log 2>&1
node critic/scripts/c16o_l_lategame.mjs 4877 critic/c15_seed4877_y20.bin 3 > critic/c16o_l_4877.log 2>&1
node critic/scripts/c16_w_decade.mjs 3301 10 > critic/c16_w_3301.log 2>&1
node critic/scripts/c16o_w_decade.mjs 3301 10 > critic/c16o_w_3301.log 2>&1
echo done > critic/c16_pagetime.done
