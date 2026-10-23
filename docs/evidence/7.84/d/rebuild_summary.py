"""PLAN 7.84d: navyRebuild.ts on HEAD and dd3b730 side by side.

Usage: python -I rebuild_summary.py <dir> <seed>...
Per year: armed power, built (power, fleets), and the depleted nation-months by the first test
that stops a warship. Per year-1 navy: its peak, spells' first warship order, months by reason.
"""
import json
import sys

d = sys.argv[1]
for s in sys.argv[2:]:
    data = {v: json.load(open(f'{d}/{v}_rebuild_{s}.json', encoding='utf-8')) for v in ('old', 'head')}
    print(f'## seed {s}')
    reasons = list(data['old']['rows'][0]['months'].keys())
    print('year | ver | power | built k | fleets built | ' + ' | '.join(reasons))
    for i in range(len(data['old']['rows'])):
        for v in ('old', 'head'):
            r = data[v]['rows'][i]
            print(f"{r['year']} | {v} | {r['power'] // 1000}k | {r['built'] // 1000} | {r['builtFleets']} | " + ' | '.join(str(r['months'][k]) for k in reasons))
    tot = {v: {k: sum(r['months'][k] for r in data[v]['rows'][1:]) for k in reasons} for v in data}
    print('years 2+ total:')
    for v in data:
        print(f'  {v}: ' + ', '.join(f'{k} {n}' for k, n in tot[v].items() if n))
    print('per navy (months years 1+, spells: from day / first order after days):')
    tags = sorted(set(data['old']['nations']) | set(data['head']['nations']), key=lambda n: -max(data[v]['nations'].get(n, {}).get('peak', 0) for v in data))
    for n in tags:
        for v in data:
            x = data[v]['nations'].get(n)
            if not x:
                print(f'  {n} {v}: -')
                continue
            ms = ', '.join(f'{k} {c}' for k, c in x['months'].items() if c)
            sp = ' '.join(f"{p['from']}/{p.get('firstOrder', '-')}" for p in x['spells'])
            print(f"  {x['tag']} {v}: peak {round(x['peak'] / 1000)}k; {ms}; spells {sp}; spent {x['spent']}")
