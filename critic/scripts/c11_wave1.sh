#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c11_c_battle.mjs 7019 > critic/c11_c.log 2>&1 &
node critic/scripts/c11_h_misc.mjs 1307 3 > critic/c11_h.log 2>&1 &
node critic/scripts/c11_s_stale.mjs 6421 > critic/c11_s.log 2>&1 &
node critic/scripts/c11_q_god_tools.mjs 6421 > critic/c11_q.log 2>&1 &
wait
echo done > critic/c11_wave1.done
