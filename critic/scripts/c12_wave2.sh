#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c12_g_editor.mjs 4877 > critic/c12_g.log 2>&1 &
node critic/scripts/c12_g2_poland.mjs 9437 POL GER warsaw 120 > critic/c12_g2a.log 2>&1 &
node critic/scripts/c12_g2_poland.mjs 5309 CZS GER prague 120 > critic/c12_g2b.log 2>&1 &
node critic/scripts/c12_n_seabattles.mjs 2081 GER ENG 12 > critic/c12_n1.log 2>&1 &
node critic/scripts/c12_n_seabattles.mjs 8693 JAP USA 20 > critic/c12_n2.log 2>&1 &
wait
node critic/scripts/c12_e_hulls_naval.mjs 3613 > critic/c12_e.log 2>&1 &
node critic/scripts/c12_z_zoom.mjs 5861 > critic/c12_z.log 2>&1 &
node critic/scripts/c12_a_god_nuke.mjs 4219 > critic/c12_a.log 2>&1 &
node critic/scripts/c12_r_random.mjs > critic/c12_r.log 2>&1 &
wait
echo done > critic/c12_wave2.done
