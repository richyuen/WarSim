#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c15_c_battle.mjs 7019 > critic/c15_c.log 2>&1 &
node critic/scripts/c15_a_god_nuke.mjs 4219 > critic/c15_a.log 2>&1 &
node critic/scripts/c15_m_misc2.mjs > critic/c15_m.log 2>&1 &
node critic/scripts/c15_g_editor.mjs 4877 > critic/c15_g.log 2>&1 &
wait
node critic/scripts/c15_k_breakthrough.mjs 2203 > critic/c15_k.log 2>&1 &
node critic/scripts/c15_q_god_tools.mjs 6421 > critic/c15_q.log 2>&1 &
node critic/scripts/c15_p_phone.mjs > critic/c15_p.log 2>&1 &
node critic/scripts/c15_z_zoom.mjs 5861 > critic/c15_z.log 2>&1 &
wait
node critic/scripts/c15_g2_poland.mjs 9437 > critic/c15_g2.log 2>&1 &
node critic/scripts/c15_n4_rowless.mjs > critic/c15_n4.log 2>&1 &
node critic/scripts/c15_g4_standoff_track.mjs > critic/c15_g4.log 2>&1 &
node critic/scripts/c15_play.mjs 6011 > critic/c15_pl.log 2>&1 &
wait
node critic/scripts/c15_h_misc.mjs 1307 3 > critic/c15_h.log 2>&1 &
node critic/scripts/c15_e_hulls_naval.mjs 3613 > critic/c15_e.log 2>&1 &
node critic/scripts/c15_v_explore.mjs A > critic/c15_vA.log 2>&1 &
node critic/scripts/c15_v_explore.mjs C > critic/c15_vC.log 2>&1 &
wait
echo done > critic/c15_wave1.done
