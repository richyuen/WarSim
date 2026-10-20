// PLAN 7.46a: `navyRebuild` on 4 seeds x 10 years, before (HEAD) and after (the chase). Usage: node docs/evidence/7.46/a/sum.mjs
/* global console */
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const D = dirname(fileURLToPath(import.meta.url)); const S = [1307, 3613, 8693, 7019];
const R = ['aiOff','noShipyard','poor','warshipInTraining','transportInTraining','transportWanted','navyShare','gold','men','balance','spentArmy','spentOther','ordered'];
for (const t of ['before', 'after']) {
  const J = S.map((s) => JSON.parse(readFileSync(`${D}/${t}_${s}.json`, 'utf8')));
  console.log(`\n== ${t}`);
  for (let y = 0; y < 10; y++) {
    const m = (k) => J.reduce((a, j) => a + j.rows[y][k], 0) / 4;
    console.log(y + 1, `power ${(m('power')/1e3).toFixed(0)}k short ${(m('shortfall')/1e3).toFixed(0)}k lost ${(m('lostInBattle')/1e3).toFixed(0)}k built ${(m('built')/1e3).toFixed(1)}k (${m('builtFleets').toFixed(1)} fleets)`);
  }
  for (const [lab, a, b] of [['y1', 0, 1], ['y2-10', 1, 10], ['y3-10', 2, 10]]) {
    const months = {}, w = {}, lost = {};
    for (const j of J) for (const r of j.rows.slice(a, b)) for (const k of R) { months[k] = (months[k] ?? 0) + r.months[k]; w[k] = (w[k] ?? 0) + r.weighted[k]; lost[k] = (lost[k] ?? 0) + r.lostMonths[k]; }
    const tm = R.reduce((x, k) => x + months[k], 0), tw = R.reduce((x, k) => x + w[k], 0);
    console.log(lab, `months ${tm}, weighted ${tw.toFixed(0)}k-months:`, R.filter((k) => months[k]).map((k) => `${k} ${months[k]} (${(100*w[k]/tw).toFixed(0)}% w, lost ${lost[k]})`).join(', '));
  }
  const sh = {}, it = {};
  for (const j of J) for (const r of j.rows.slice(1)) { for (const [k, v] of Object.entries(r.share)) sh[k] = (sh[k] ?? 0) + v; for (const [k, v] of Object.entries(r.inTraining)) it[k] = (it[k] ?? 0) + v; }
  console.log('navyShare by share%:', JSON.stringify(sh), 'inTraining days left:', JSON.stringify(it));
  // top nations by weighted shortfall years 1-10
  const nat = J.flatMap((j) => Object.values(j.nations).map((x) => ({ ...x, seed: j.seed })));
  nat.sort((p, q) => R.reduce((a, k) => a + q.weighted[k], 0) - R.reduce((a, k) => a + p.weighted[k], 0));
  for (const x of nat.slice(0, 12)) {
    const tw = R.reduce((a, k) => a + x.weighted[k], 0);
    console.log(x.seed, x.tag, `peak ${(x.peak/1e3).toFixed(1)}k w ${tw.toFixed(0)}`, R.filter((k) => x.months[k]).map((k) => `${k} ${x.months[k]}`).join(' '), '| spells', x.spells.map((s) => `${s.from}-${s.to ?? 'end'} low ${(s.low/1e3).toFixed(1)}k first ${s.firstOrder ?? '-'}`).join('; '));
  }
}
