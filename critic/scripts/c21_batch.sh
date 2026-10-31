#!/bin/sh
# Critic run 19: 30-year unaided worlds on HEAD (c689c2e4). 4 of run 18's seeds (identity check: yearly hashes against
# c18_headless_*.json on cfa73219) + 8 new seeds.
cd /c/Git/Warism
run() { s=$1; npx tsx critic/scripts/c21_headless.ts $s 30 critic/c21_headless_$s.json 20 critic/c21_seed${s}_y20.bin > critic/c21_headless_$s.log 2>&1; }
wave() { for s in "$@"; do run $s & done; wait; }
wave 6599 2539 1307 7019 1213 2617 3301 4441
wave 5557 6673 7717 8819
echo ALLDONE > critic/c21_batch.done
