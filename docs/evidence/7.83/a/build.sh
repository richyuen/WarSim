#!/bin/sh
# Bundles of dd3b730 and HEAD's headless CLI: build.sh
cd /c/Git/WarSim
D=.cache/prof83
B="--bundle --platform=node --format=esm --log-level=warning"
rm -rf $D/base_src && mkdir -p $D/base_src
git archive dd3b730 src tools data | tar -x -C $D/base_src
npx esbuild $D/base_src/tools/headless/cli.ts $B "--banner:js=import{createRequire}from'module';const require=createRequire(import.meta.url);" --outfile=$D/base.mjs
npx esbuild tools/headless/cli.ts $B "--banner:js=import{createRequire}from'module';const require=createRequire(import.meta.url);" --outfile=$D/head.mjs
