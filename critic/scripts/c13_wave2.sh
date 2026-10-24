#!/bin/sh
cd /c/Git/WarSim
while [ ! -f critic/c13_wave1.done ]; do sleep 5; done
node critic/scripts/c13_h_misc.mjs 1307 3 > critic/c13_h.log 2>&1 &
node critic/scripts/c13_n_seabattles.mjs 8693 JAP USA 20 > critic/c13_n2.log 2>&1 &
node critic/scripts/c13_n4_rowless.mjs > critic/c13_n4.log 2>&1 &
node critic/scripts/c13_g4_standoff_track.mjs > critic/c13_g4.log 2>&1 &
wait
node critic/scripts/c13_e_hulls_naval.mjs 3613 > critic/c13_e.log 2>&1 &
node critic/scripts/c13_z_zoom.mjs 5861 > critic/c13_z.log 2>&1 &
node critic/scripts/c13_g2_poland.mjs 9437 POL GER warsaw 120 > critic/c13_g2a.log 2>&1 &
node critic/scripts/c13_r_random.mjs > critic/c13_r.log 2>&1 &
wait
echo done > critic/c13_wave2.done
