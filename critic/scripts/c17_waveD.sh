#!/bin/sh
cd /c/Git/WarSim
r() { name=$1; shift; timeout 3600 node critic/scripts/c17_$name.mjs "$@" > critic/c17_$name$(echo "_$*" | tr ' /' '__').log 2>&1; echo "$name $* exit $?" >> critic/c17_waveD.status; }
r y2_latewar 7019 critic/c17_seed7019_y20.bin y20
r y2_latewar 4877 critic/c17_seed4877_y20.bin y20
r y2_latewar 6421 critic/c17_seed6421_y20.bin y20
r u_lateair 6421 critic/c17_seed6421_y20.bin
r np2_nukepause 4877 critic/c17_seed4877_y20.bin
r h_misc 1307 3
echo done >> critic/c17_waveD.status
