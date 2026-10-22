#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c12_c_battle.mjs 7019 > critic/c12_c.log 2>&1 &
node critic/scripts/c12_h_misc.mjs 1307 3 > critic/c12_h.log 2>&1 &
node critic/scripts/c12_s_stale.mjs 6421 > critic/c12_s.log 2>&1 &
node critic/scripts/c12_q_god_tools.mjs 6421 > critic/c12_q.log 2>&1 &
wait
echo done > critic/c12_wave1.done
