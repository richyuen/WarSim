#!/bin/sh
# Two bundles at once on separate P-cores, then swapped: pair.sh <tag> <a> <b> <args...>
cd /c/Git/WarSim
D=.cache/prof83
tag=$1; a=$2; b=$3; shift 3
for r in 1 2; do
  if [ $r -eq 1 ]; then ma=0x000F; mb=0x0F00; else ma=0x0F00; mb=0x000F; fi
  node $D/$a.mjs "$@" --affinity $ma > $D/${tag}_${a}$r.log 2>&1 &
  node $D/$b.mjs "$@" --affinity $mb > $D/${tag}_${b}$r.log 2>&1 &
  wait
done
