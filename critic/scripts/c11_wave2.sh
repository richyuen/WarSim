#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c11_g_editor.mjs 4877 > critic/c11_g.log 2>&1 &
node critic/scripts/c11_g2_poland.mjs 9437 POL GER warsaw 120 > critic/c11_g2a.log 2>&1 &
node critic/scripts/c11_g2_poland.mjs 5309 CZS GER prague 120 > critic/c11_g2b.log 2>&1 &
node critic/scripts/c11_n_seabattles.mjs 2081 GER ENG 12 > critic/c11_n.log 2>&1 &
wait
node critic/scripts/c11_e_hulls_naval.mjs 3613 > critic/c11_e.log 2>&1 &
node critic/scripts/c11_z_zoom.mjs 5861 > critic/c11_z.log 2>&1 &
node critic/scripts/c11_a_god_nuke.mjs 4219 > critic/c11_a.log 2>&1 &
node critic/scripts/c11_r_random.mjs > critic/c11_r.log 2>&1 &
wait
echo done > critic/c11_wave2.done
