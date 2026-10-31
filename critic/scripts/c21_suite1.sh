#!/bin/sh
# Critic run 21: run 20's page probes re-run on HEAD (port 5399), one after another.
cd /c/Git/Warism
r() { name=$1; shift; echo "== $name $* $(date +%T)"; timeout 1500 node critic/scripts/$name.mjs "$@" > critic/$name.$(echo "$*" | tr ' /' '__').log 2>&1; echo "   exit $?"; }
r c21_q_god_tools 6421
r c21_k_breakthrough 2203
r c21_play 6011
r c21_g_editor 4877
r c21_fight 5381 21
r c21_fp2_fight 4877
OUT=c21_os_c10fmt1.json TAG=c10fmt1 r c21_oldsave critic/c10_seed4219_y10.bin 4219 1
r c21_a_god_nuke 4219
r c21_z_zoom 5861
r c21_c_battle 7019
r c21_ww_watch 3301
while [ ! -f critic/c21_ident.done ]; do sleep 20; done
r c21_dl_export 7019 critic/c21_seed7019_y20.bin
r c21_hist 7019 critic/c21_seed7019_y20.bin
echo SUITE1DONE
