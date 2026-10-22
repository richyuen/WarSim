#!/bin/sh
# PLAN 7.65: purse.ts on the 48 saves, 4 shards side by side. Usage: run.sh <label> <days>
L=$1; D=$2; T=$(mktemp -d); O=docs/evidence/7.65
for y in y10 y20; do
  i=0; set --
  for b in critic/c11_seed*_$y.bin; do s=${b#critic/c11_seed}; s=${s%_$y.bin}; set -- "$@" "$s:$b"; done
  echo "$@" | tr ' ' '\n' | awk -v n=4 '{print > ("'"$T"'/shard_" (NR%n))}'
  for k in 0 1 2 3; do npx tsx tools/diag/purse.ts "$O/${L}_${y}_$k.json" "$D" $(cat "$T/shard_$k") 2>>"$O/${L}_${y}.log" & done
  wait
done
