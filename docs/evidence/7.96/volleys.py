"""PLAN 7.96: the volleys and the civilian share of `nukeVolume.ts` rows, per tree.
Usage: python volleys.py <label>=<pattern with {}> ... --seeds 1307,2953,...
"""
import json, sys
args = [a for a in sys.argv[1:] if not a.startswith('--')]
seeds = [int(s) for s in next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--seeds=')), '1307,2953,3613,5861').split(',')]
print('| Tree | Bursts | Within 30 d of its own last | Within 60 d | Civ > 10 × men | ≥ 1 M civilians | Strikers a world | Longest chain (≤ 60 d) |')
print('|---|---|---|---|---|---|---|---|')
for a in args:
    label, pat = a.split('=', 1)
    tot = v30 = v60 = civ = mil = strikers = longest = 0
    for s in seeds:
        r = json.load(open(pat.format(s)))
        bs = sorted(r['bursts'], key=lambda b: b['year'])
        tot += len(bs); civ += r['total']['civOver10x']
        mil += sum(1 for b in bs if b['dead'] - b['men'] >= 1_000_000)
        strikers += len(set(b['by'] for b in bs))
        last, chain = {}, {}
        for b in bs:
            d = b['year'] * 365
            if b['by'] in last:
                gap = d - last[b['by']]
                v30 += gap <= 30; v60 += gap <= 60
                chain[b['by']] = chain[b['by']] + 1 if gap <= 60 else 1
            else:
                chain[b['by']] = 1
            longest = max(longest, chain[b['by']]); last[b['by']] = d
    pc = lambda k: f'{k} ({k / tot:.0%})' if tot else f'{k}'
    print(f'| {label} | {tot} | {pc(v30)} | {pc(v60)} | {pc(civ)} | {mil} | {strikers / len(seeds):.1f} | {longest} |')
