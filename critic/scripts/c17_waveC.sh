#!/bin/sh
cd /c/Git/WarSim
r() { name=$1; shift; timeout 3600 node critic/scripts/c17_$name.mjs "$@" > critic/c17_$name$(echo "_$*" | tr ' /' '__').log 2>&1; echo "$name $* exit $?" >> critic/c17_waveC.status; }
r y2_latewar 1607 critic/c17_seed1607_y20.bin y20
r y2_latewar 5419 critic/c17_seed5419_y20.bin y20
r u_lateair 1607 critic/c17_seed1607_y20.bin
r t_restraint 2213 critic/c17_seed2213_y20.bin
r hist 3727 critic/c17_seed3727_y20.bin
r dl_export 3727 critic/c17_seed3727_y20.bin
r cv_carrier 6301 critic/c17_seed6301_y20.bin
echo done >> critic/c17_waveC.status
