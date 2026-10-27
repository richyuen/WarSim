#!/bin/sh
cd /c/Git/WarSim
g() { for c in "$@"; do sh -c "$c" & done; wait; }
g "node critic/scripts/c16_cv_carrier.mjs 4877 > critic/c16_cv.log 2>&1" "node critic/scripts/c16_fp2_fight.mjs 5381 > critic/c16_fp2a.log 2>&1" "node critic/scripts/c16_fp2_fight.mjs 4877 > critic/c16_fp2b.log 2>&1"
g "node critic/scripts/c16_cv_carrier.mjs 8167 critic/c16_seed8167_y20.bin > critic/c16_cv2.log 2>&1" "node critic/scripts/c16_y2_latewar.mjs 7019 critic/c16_seed7019_y20.bin y20 > critic/c16_y2_7019_y20.log 2>&1" "node critic/scripts/c16_y2_latewar.mjs 4877 critic/c16_seed4877_y20.bin y20 > critic/c16_y2_4877_y20.log 2>&1"
g "node critic/scripts/c16_y2_latewar.mjs 6421 critic/c16_seed6421_y20.bin y20 > critic/c16_y2_6421_y20.log 2>&1" "node critic/scripts/c16_y2_latewar.mjs 1129 critic/c16_seed1129_y10.bin y10 > critic/c16_y2_1129_y10.log 2>&1" "node critic/scripts/c16_u_lateair.mjs 6421 critic/c16_seed6421_y20.bin > critic/c16_u.log 2>&1"
g "node critic/scripts/c16_np2_nukepause.mjs 4877 critic/c16_seed4877_y20.bin > critic/c16_np2.log 2>&1" "node critic/scripts/c16_t_restraint.mjs 1129 critic/c16_seed1129_y20.bin > critic/c16_t.log 2>&1" "node critic/scripts/c16_x_mapview.mjs 7019 critic/c16_seed7019_y20.bin 7019y20 > critic/c16_x_7019.log 2>&1"
g "node critic/scripts/c16_hist.mjs 4877 critic/c16_seed4877_y20.bin > critic/c16_hi.log 2>&1" "node critic/scripts/c16_dl_export.mjs 4877 critic/c16_seed4877_y20.bin > critic/c16_dl.log 2>&1" "node critic/scripts/c16_tg_tags.mjs 7019 > critic/c16_tg.log 2>&1"
g "node critic/scripts/c16_ww_watch.mjs 3389 > critic/c16_ww.log 2>&1" "node critic/scripts/c16_u_lateair.mjs 4877 critic/c16_seed4877_y20.bin > critic/c16_u2.log 2>&1" "node critic/scripts/c16_v2_large.mjs L 3001 > critic/c16_v2L.log 2>&1"
echo done > critic/c16_wave2.done
