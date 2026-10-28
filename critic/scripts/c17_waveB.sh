#!/bin/sh
cd /c/Git/WarSim
until grep -q done critic/c17_waveA.status 2>/dev/null; do sleep 20; done
r() { name=$1; shift; timeout 3600 node critic/scripts/c17_$name.mjs "$@" > critic/c17_$name$(echo "_$*" | tr ' ' '_').log 2>&1; echo "$name $* exit $?" >> critic/c17_waveB.status; }
r cvashore 99
r ww_watch 1607
r fp2_fight 4877
echo done >> critic/c17_waveB.status
