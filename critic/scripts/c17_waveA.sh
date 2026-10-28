#!/bin/sh
# Critic run 17: run 16's page probes re-run on HEAD (port 5336), one at a time.
cd /c/Git/WarSim
r() { name=$1; shift; timeout 2400 node critic/scripts/c17_$name.mjs "$@" > critic/c17_$name$(echo "_$*" | tr ' ' '_').log 2>&1; echo "$name $* exit $?" >> critic/c17_waveA.status; }
r a_god_nuke 4219
r q_god_tools 6421
r k_breakthrough 2203
r k3_breakthrough_war 7019
r p_phone
r c_battle 7019
r z_zoom 5861
r tg_tags 7019
r m_misc2
r play 6011
r g_editor 4877
r g2_poland 9437
r g4_standoff_track 4877
r n4_rowless 8693
r fp2_fight 5381
echo done >> critic/c17_waveA.status
