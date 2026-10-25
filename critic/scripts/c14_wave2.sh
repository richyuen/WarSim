#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c14_v_explore.mjs A > critic/c14_vA.log 2>&1 &
node critic/scripts/c14_v_explore.mjs B > critic/c14_vB.log 2>&1 &
node critic/scripts/c14_v_explore.mjs C > critic/c14_vC.log 2>&1 &
node critic/scripts/c14_t_restraint.mjs 1129 critic/c14_seed1129_y20.bin > critic/c14_t.log 2>&1 &
wait
node critic/scripts/c14_h_misc.mjs 1307 3 > critic/c14_h.log 2>&1 &
node critic/scripts/c14_n_seabattles.mjs 8693 JAP USA 20 > critic/c14_n.log 2>&1 &
node critic/scripts/c14_u_lateair.mjs 6421 critic/c14_seed6421_y20.bin > critic/c14_u.log 2>&1 &
node critic/scripts/c14_x_mapview.mjs 7019 critic/c14_seed7019_y20.bin 7019y20 > critic/c14_x_7019.log 2>&1 &
wait
echo done > critic/c14_wave2.done
