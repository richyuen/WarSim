#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c13_s_stale.mjs 6421 > critic/c13_s.log 2>&1 &
node critic/scripts/c13_q_god_tools.mjs 6421 > critic/c13_q.log 2>&1 &
node critic/scripts/c13_k_breakthrough.mjs 2203 > critic/c13_k.log 2>&1 &
node critic/scripts/c13_p_phone.mjs > critic/c13_p.log 2>&1 &
wait
node critic/scripts/c13_c_battle.mjs 7019 > critic/c13_c.log 2>&1 &
node critic/scripts/c13_a_god_nuke.mjs 4219 > critic/c13_a.log 2>&1 &
node critic/scripts/c13_m_misc2.mjs > critic/c13_m.log 2>&1 &
node critic/scripts/c13_g_editor.mjs 4877 > critic/c13_g.log 2>&1 &
wait
echo done > critic/c13_wave1.done
