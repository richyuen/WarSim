#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c14_c_battle.mjs 7019 > critic/c14_c.log 2>&1 &
node critic/scripts/c14_a_god_nuke.mjs 4219 > critic/c14_a.log 2>&1 &
node critic/scripts/c14_m_misc2.mjs > critic/c14_m.log 2>&1 &
node critic/scripts/c14_g_editor.mjs 4877 > critic/c14_g.log 2>&1 &
wait
node critic/scripts/c14_s_stale.mjs 6421 > critic/c14_s.log 2>&1 &
node critic/scripts/c14_z_zoom.mjs 5861 > critic/c14_z.log 2>&1 &
node critic/scripts/c14_e_hulls_naval.mjs 3613 > critic/c14_e.log 2>&1 &
node critic/scripts/c14_r_random.mjs > critic/c14_r.log 2>&1 &
wait
echo done > critic/c14_wave1.done
