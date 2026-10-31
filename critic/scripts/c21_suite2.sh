#!/bin/sh
# Critic run 21: run 20's UI probes behind its non-blocking list, re-run on HEAD (port 5399).
cd /c/Git/Warism
r() { name=$1; shift; echo "== $name $* $(date +%T)"; timeout 1500 node critic/scripts/$name.mjs "$@" > critic/$name.$(echo "$*" | tr ' /' '__').log 2>&1; echo "   exit $?"; }
r c21_u_ui 5557 1600 900
r c21_w_wing 5557
r c21_p_phone
r c21_p2_phone_menu
r c21_p3_widths
r c21_os_scen
r c21_pt_touch
r c21_ph_phone2
r c21_tg_tags 7019
echo SUITE2DONE
