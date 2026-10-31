#!/bin/sh
# Critic run 21: identity check, run 20's seeds 1213 and 3301 x 30 years on HEAD (bd7940de) against c20_headless_*.json; plus 7019 x 20 saved for the page probes (run 20's c18 save was deleted).
cd /c/Git/Warism
npx tsx critic/scripts/c21_headless.ts 1213 30 critic/c21_headless_1213.json > critic/c21_headless_1213.log 2>&1 &
npx tsx critic/scripts/c21_headless.ts 3301 30 critic/c21_headless_3301.json > critic/c21_headless_3301.log 2>&1 &
npx tsx critic/scripts/c21_headless.ts 7019 20 critic/c21_headless_7019.json 20 critic/c21_seed7019_y20.bin > critic/c21_headless_7019.log 2>&1 &
wait
echo DONE > critic/c21_ident.done
