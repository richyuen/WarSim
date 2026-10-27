#!/bin/sh
cd /c/Git/WarSim
g() { for c in "$@"; do sh -c "$c" & done; wait; }
g "node critic/scripts/c16_c_battle.mjs 7019 > critic/c16_c.log 2>&1" "node critic/scripts/c16_a_god_nuke.mjs 4219 > critic/c16_a.log 2>&1" "node critic/scripts/c16_m_misc2.mjs > critic/c16_m.log 2>&1"
g "node critic/scripts/c16_g_editor.mjs 4877 > critic/c16_g.log 2>&1" "node critic/scripts/c16_k_breakthrough.mjs 2203 > critic/c16_k.log 2>&1" "node critic/scripts/c16_q_god_tools.mjs 6421 > critic/c16_q.log 2>&1"
g "node critic/scripts/c16_p_phone.mjs > critic/c16_p.log 2>&1" "node critic/scripts/c16_z_zoom.mjs 5861 > critic/c16_z.log 2>&1" "node critic/scripts/c16_g2_poland.mjs 9437 > critic/c16_g2.log 2>&1"
g "node critic/scripts/c16_n4_rowless.mjs > critic/c16_n4.log 2>&1" "node critic/scripts/c16_g4_standoff_track.mjs > critic/c16_g4.log 2>&1" "node critic/scripts/c16_play.mjs 6011 > critic/c16_pl.log 2>&1"
g "node critic/scripts/c16_h_misc.mjs 1307 3 > critic/c16_h.log 2>&1" "node critic/scripts/c16_e_hulls_naval.mjs 3613 > critic/c16_e.log 2>&1" "node critic/scripts/c16_fp_fleetpanel.mjs 4877 > critic/c16_fp.log 2>&1"
g "node critic/scripts/c16_v_explore.mjs A > critic/c16_vA.log 2>&1" "node critic/scripts/c16_v_explore.mjs C > critic/c16_vC.log 2>&1" "node critic/scripts/c16_k3_breakthrough_war.mjs 7019 > critic/c16_k3.log 2>&1"
echo done > critic/c16_wave1.done
