#!/bin/sh
# Critic run 19: run 18's page probes re-run on HEAD (port 5349), one after another.
cd /c/Git/Warism
r() { name=$1; shift; echo "== $name $* $(date +%T)"; timeout 1500 node critic/scripts/$name.mjs "$@" > critic/$name.$(echo "$*" | tr ' /' '__').log 2>&1; echo "   exit $?"; }
r c20_q_god_tools 6421
r c20_k_breakthrough 2203
r c20_play 6011
r c20_g_editor 4877
r c20_fight 5381 21
r c20_fp2_fight 4877
OUT=c20_os_c10fmt1.json TAG=c10fmt1 r c20_oldsave critic/c10_seed4219_y10.bin 4219 1
OUT=c20_os_c18fmt1.json TAG=c18fmt1 r c20_oldsave critic/c18_seed7019_y20.bin 7019 1
r c20_dl_export 7019 critic/c18_seed7019_y20.bin
r c20_hist 7019 critic/c18_seed7019_y20.bin
r c20_a_god_nuke 4219
r c20_z_zoom 5861
r c20_c_battle 7019
r c20_ww_watch 3301
echo SUITE1DONE
