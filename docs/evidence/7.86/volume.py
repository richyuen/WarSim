"""PLAN 7.86: the bursts' rise split into the world (more wars, more warheads) and the rule.

Reads `nv_<seed>.json` (tools/diag/nukeVolume.ts) of three trees, given as directories:
  old  = dd3b730 (the critic's run 11 code), its world and its nuclear rule;
  rule = HEAD's world with dd3b730's src/sim/systems/nuclear.ts;
  head = HEAD.
old -> rule is the world's part; rule -> head is the rule's.
Usage: python volume.py <old dir> <rule dir> <head dir> [seeds...]
"""
import json
import sys
from pathlib import Path

dirs = {'old': Path(sys.argv[1]), 'rule': Path(sys.argv[2]), 'head': Path(sys.argv[3])}
seeds = [int(s) for s in sys.argv[4:]] or [1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167]
KEYS = ['bursts', 'decided', 'civOver10x', 'wars', 'warDays', 'holderDays', 'holderWarDays', 'stockWarDays', 'built']


def load(name):
    rows = {}
    for s in seeds:
        p = dirs[name] / f'nv_{s}.json'
        if p.exists():
            rows[s] = json.loads(p.read_text(encoding='utf-8'))
    return rows


data = {k: load(k) for k in dirs}
common = [s for s in seeds if all(s in data[k] for k in dirs)]
print(f'seeds read in all three: {len(common)} {common}')


def tot(name, part=None):
    t = {k: 0 for k in KEYS}
    t['holders'] = 0
    t['million'] = 0
    t['worlds'] = 0
    for s in common:
        r = data[name][s]
        src = r['total'] if part is None else r['thirds'][part]
        for k in KEYS:
            t[k] += src[k]
        if part is None:
            t['holders'] += r['holders']
            t['million'] += sum(1 for b in r['bursts'] if b['dead'] - b['men'] >= 1_000_000)
            t['worlds'] += 1 if r['total']['bursts'] > 0 else 0
    return t


def line(label, t, n):
    hwd = t['holderWarDays']
    rate = 1000 * t['bursts'] / hwd if hwd else 0
    share = t['holderWarDays'] / t['holderDays'] if t['holderDays'] else 0
    stock = t['stockWarDays'] / hwd if hwd else 0
    return (f"| {label} | {t['bursts']} ({t['bursts'] / n:.1f}) | {t['civOver10x']} | {t.get('million', '')} | {t.get('worlds', '')} | "
            f"{t['wars'] / n:.0f} | {t['warDays'] / n / 365:.0f} | {t['holderDays'] / n / 365:.1f} | {share:.2f} | "
            f"{hwd / n / 365:.1f} | {stock:.1f} | {t['built'] / n:.0f} | {rate:.2f} |")


n = len(common)
print()
print('| Tree | Bursts (a world) | Civ > 10 × men | ≥ 1 M civilians | Worlds with a burst | Wars declared a world | '
      'Nation-years at war a world | Holder-years a world | Their share at war | Holder-years at war a world | '
      'Stock a holder-day at war | Warheads built a world | Bursts per 1,000 holder-days at war |')
print('|' + '---|' * 13)
for k in dirs:
    print(line(k, tot(k), n))
print()
print('By ten-year third (bursts; holder-years at war a world; bursts per 1,000 holder-days at war):')
for part in range(3):
    cells = []
    for k in dirs:
        t = tot(k, part)
        hwd = t['holderWarDays']
        cells.append(f"{k} {t['bursts']}; {hwd / n / 365:.1f}; {1000 * t['bursts'] / hwd if hwd else 0:.2f}")
    print(f'  years {10 * part + 1}-{10 * part + 10}: ' + ' | '.join(cells))

o, r, h = tot('old'), tot('rule'), tot('head')
print()
print(f"bursts old {o['bursts']} -> rule {r['bursts']} (the world, x{r['bursts'] / max(1, o['bursts']):.2f}) "
      f"-> head {h['bursts']} (the rule, x{h['bursts'] / max(1, r['bursts']):.2f}); all x{h['bursts'] / max(1, o['bursts']):.2f}")
hw = lambda t: t['holderWarDays']
rate = lambda t: t['bursts'] / hw(t) if hw(t) else 0
print(f"holder-days at war old -> rule x{hw(r) / max(1, hw(o)):.2f}: holder-days x{r['holderDays'] / max(1, o['holderDays']):.2f} "
      f"(warheads), their share at war x{(hw(r) / r['holderDays']) / max(1e-9, hw(o) / o['holderDays']):.2f} (wars); "
      f"bursts per holder-day at war old -> rule x{rate(r) / max(1e-9, rate(o)):.2f}, rule -> head x{rate(h) / max(1e-9, rate(r)):.2f}")
print()
print('Per seed (bursts old / rule / head; holder-years at war old / rule / head):')
for s in common:
    b = [data[k][s]['total']['bursts'] for k in dirs]
    y = [data[k][s]['total']['holderWarDays'] / 365 for k in dirs]
    print(f'  {s}: {b[0]} / {b[1]} / {b[2]}; {y[0]:.1f} / {y[1]:.1f} / {y[2]:.1f}')
