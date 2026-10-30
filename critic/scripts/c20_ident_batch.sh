#!/bin/sh
# Critic run 20: identity check, two of run 19's new seeds x 30 years on HEAD (a3edf009); hashes against c19_headless_*.json.
cd /c/Git/Warism
for s in 1213 3301; do npx tsx critic/scripts/c20_headless.ts $s 30 critic/c20_headless_$s.json > critic/c20_headless_$s.log 2>&1 & done
wait
echo DONE > critic/c20_ident.done
