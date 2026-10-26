#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c15_y2_latewar.mjs 4877 critic/c15_seed4877_y20.bin y20 > critic/c15_y2_4877_y20.log 2>&1 &
node critic/scripts/c15_y2_latewar.mjs 7019 critic/c15_seed7019_y20.bin y20 > critic/c15_y2_7019_y20.log 2>&1 &
node critic/scripts/c15_y2_latewar.mjs 1129 critic/c15_seed1129_y10.bin y10 > critic/c15_y2_1129_y10.log 2>&1 &
node critic/scripts/c15_y2_latewar.mjs 6421 critic/c15_seed6421_y20.bin y20 > critic/c15_y2_6421_y20.log 2>&1 &
wait
node critic/scripts/c15_np2_nukepause.mjs 8167 critic/c15_seed8167_y20.bin > critic/c15_np2.log 2>&1 &
node critic/scripts/c15_t_restraint.mjs 1129 critic/c15_seed1129_y20.bin > critic/c15_t.log 2>&1 &
node critic/scripts/c15_x_mapview.mjs 7019 critic/c15_seed7019_y20.bin 7019y20 > critic/c15_x_7019.log 2>&1 &
node critic/scripts/c15_hist.mjs 4877 critic/c15_seed4877_y20.bin > critic/c15_hi.log 2>&1 &
wait
node critic/scripts/c15_u_lateair.mjs 6421 critic/c15_seed6421_y20.bin > critic/c15_u.log 2>&1 &
node critic/scripts/c15_n_seabattles.mjs 8693 JAP USA 20 > critic/c15_n.log 2>&1 &
node critic/scripts/c15_v_explore.mjs B > critic/c15_vB.log 2>&1 &
node critic/scripts/c15_v2_large.mjs L 3001 > critic/c15_v2L.log 2>&1 &
wait
echo done > critic/c15_wave2.done
