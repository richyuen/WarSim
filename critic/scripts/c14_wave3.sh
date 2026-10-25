#!/bin/sh
cd /c/Git/WarSim
node critic/scripts/c14_g2_poland.mjs 9437 > critic/c14_g2.log 2>&1 &
node critic/scripts/c14_n4_rowless.mjs > critic/c14_n4.log 2>&1 &
node critic/scripts/c14_f_ainuke_browser.mjs 7019 critic/c14_seed7019_y20.bin 320 > critic/c14_f.log 2>&1 &
wait
echo done > critic/c14_wave3.done
