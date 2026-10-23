#!/bin/sh
# hcheck.sh <tag>: bundle the working tree as <tag>.mjs and run year 5 from h0's year-4 save; prints the hash line
cd /c/Git/WarSim
D=.cache/prof83
B="--bundle --platform=node --format=esm --log-level=warning"
npx esbuild tools/headless/cli.ts $B "--banner:js=import{createRequire}from'module';const require=createRequire(import.meta.url);" --outfile=$D/$1.mjs || exit 1
node $D/$1.mjs --scenario 1938 --seed 99 --years 1 --load $D/h0_y4.bin --affinity ${2:-0x000F} --profile > $D/$1_chk.log 2>&1
grep -E "^year|invasionAi|^done" $D/$1_chk.log
