#!/bin/sh
# pair.sh <tag> <a> <b>: year 21 of 4877 from y20.bin, two bundles at once on separate P-cores, then swapped
cd /c/Git/WarSim/.cache/prof105
tag=$1; a=$2; b=$3
for r in 1 2; do
  if [ $r -eq 1 ]; then ma=0x000F; mb=0x0F00; else ma=0x0F00; mb=0x000F; fi
  node $a.mjs --scenario 1938 --load y20.bin --years 1 --profile --affinity $ma > ${tag}_${a}$r.log 2>&1 &
  node $b.mjs --scenario 1938 --load y20.bin --years 1 --profile --affinity $mb > ${tag}_${b}$r.log 2>&1 &
  wait
done
grep -H -E "^year|operationalAi|invasionAi" ${tag}_*.log
