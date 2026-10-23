"""Summarise docs/evidence/7.84/c/{head,old}_<seed>.json (seaYears.ts, 20 years)."""
import json, glob, os, sys
D = 'docs/evidence/7.84/c'
def load(v):
    out = {}
    for f in glob.glob(f'{D}/{v}_*.json'):
        j = json.load(open(f, encoding='utf-8'))
        out[j['seed']] = {r['year']: r for r in j['rows']}
    return out
o, h = load('old'), load('head')
seeds = sorted(set(o) & set(h))
print('seeds', seeds)
def agg(d, ys):
    rows = [d[s][y] for s in seeds for y in ys if y in d[s]]
    n = len(rows)
    b = sum(r['battles'] for r in rows)
    sp = sum(r['seaPairs'] for r in rows)  # mean pairs a day, summed over world-years
    return dict(
        worldYears=n,
        battles=round(b / n, 2),
        sinkingShare=round(sum(r['sinking'] for r in rows) / max(1, b), 3),
        fleets=round(sum(r['fleets'] for r in rows) / n, 1),
        navies=round(sum(r['navies'] for r in rows) / n, 1),
        power=round(sum(r['power'] for r in rows) / n, 0),
        warPairs=round(sum(r['warPairs'] for r in rows) / n, 2),
        seaPairs=round(sp / n, 2),
        battlesPerSeaPairYear=round(b / max(1e-9, sp), 2),
        seaPairFleets=round(sum(r['seaPairFleets'] for r in rows) / n, 1),
        underWayShare=round(sum(r['underWay'] for r in rows) / max(1e-9, sum(r['seaPairFleets'] for r in rows)), 3),
    )
for name, ys in [('year 1', [1]), ('year 2', [2]), ('years 3-5', range(3, 6)), ('years 2-20', range(2, 21)), ('years 10-20', range(10, 21))]:
    print(f'== {name}')
    a, b = agg(o, ys), agg(h, ys)
    for k in a:
        print(f'   {k:22s} {a[k]!s:>10} {b[k]!s:>10}')
print('== per seed, years 2-20: battles a year, seaPairs, battles/seaPair-year (old | head)')
for s in seeds:
    def one(d):
        rows = [d[s][y] for y in range(2, 21) if y in d[s]]
        b = sum(r['battles'] for r in rows); sp = sum(r['seaPairs'] for r in rows)
        return f"{b/len(rows):6.2f} {sp/len(rows):5.2f} {b/max(1e-9,sp):6.2f}"
    print(s, one(o), '|', one(h))
