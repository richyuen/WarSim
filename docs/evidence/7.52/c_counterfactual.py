import json, sys, glob
# PLAN 7.52c: the 7.52b bursts under a heavier DEAD_COST (k x 0.1), first order: each burst's
# utility less (k-1) x through x deadCost; dropped when under strikeFloor(people, through).
files = sorted(glob.glob(sys.argv[1] + '/b-toll-*.json'))
rows = []
for f in files:
    d = json.load(open(f, encoding='utf-8'))
    for r in d['rows']:
        if 'utility' not in r or 'toll' not in r:
            continue
        rows.append((d['seed'], r))
def civ10(r):
    t = r['toll']; civ = t['dead'] - t['men']
    return civ > 10 * t['men'] or (civ > 0 and t['men'] == 0)
def floor(people, through):
    return max(0.025, 0.1 * min(1, through * people / 1e6))
print('bursts with utility rows', len(rows), 'of which civ>10x', sum(civ10(r) for _, r in rows))
print('retaliating', sum(1 for _, r in rows if r['retaliating']), 'extreme', sum(1 for _, r in rows if r['utility']['extreme']))
print('civ>10x: retaliating', sum(1 for _, r in rows if civ10(r) and r['retaliating']), 'capital place', sum(1 for _, r in rows if civ10(r) and r.get('place', {}).get('capital', 0) > 0), 'menShare 0', sum(1 for _, r in rows if civ10(r) and r.get('place', {}).get('menShare', 1) == 0))
for k in [1, 2, 3, 5, 10, 20]:
    drop = [];
    for s, r in rows:
        u = r['utility']; th = u['through']; ppl = u['people']
        dc = 0.1 * ppl / 1e6 * max(1, 2 - u['doctrine'])
        uk = r['u'] - (k - 1) * th * dc
        if uk < floor(ppl, th): drop.append((s, r))
    dc10 = sum(civ10(r) for _, r in drop)
    dead = sum(r['toll']['dead'] for _, r in drop); civ = sum(r['toll']['dead'] - r['toll']['men'] for _, r in drop)
    print(f'DEAD_COST {0.1*k:.1f}: bursts dropped {len(drop)} (civ>10x {dc10}, other {len(drop)-dc10}), dead {dead:,}, civilians {civ:,}')
print()
for s, r in rows:
    if civ10(r):
        u = r['utility']; t = r['toll']
        print(s, r['day'], r['by'], '->', r['target'], 'u', r['u'], 'thr', u['through'], 'ppl', u['people'], 'doc', u['doctrine'], 'ext', u['extreme'], 'ret', r['retaliating'], 'cap', r.get('place', {}).get('capital'), 'menSh', r.get('place', {}).get('menShare'), 'dead', t['dead'], 'men', t['men'])

# Option c: a capital's TARGET_CAPITAL only on a strike back (retaliating); a first strike weighs the
# place by its output and men alone. First order: this place's utility without the capital term.
print()
drop = []; capb = 0
for s, r in rows:
    p = r.get('place', {}); u = r['utility']
    if r['retaliating'] or not p.get('capital'): continue
    capb += 1
    share = p['econShare'] + p['menShare'] - p['ownShare']
    v2 = max(0, min(1, 10 * share)) * u['through']
    uk = r['u'] - (u['value'] - v2) * u['desperation'] * u['doctrine']
    if uk < floor(u['people'], u['through']): drop.append((s, r))
dc10 = sum(civ10(r) for _, r in drop)
print(f'capital first strikes {capb}; under the floor without the capital: {len(drop)} (civ>10x {dc10}, other {len(drop)-dc10}), dead {sum(r["toll"]["dead"] for _, r in drop):,}, men {sum(r["toll"]["men"] for _, r in drop):,}')
for s, r in drop: print('  ', s, r['day'], r['by'], '->', r['target'], r['toll'])

# The cost of option a: strikes back (retaliating) under the floor at each DEAD_COST (ADR-572's case).
print()
for k in [2, 3, 5, 10]:
    n = 0
    for s, r in rows:
        if not r['retaliating']: continue
        u = r['utility']; th = u['through']; ppl = u['people']
        if r['u'] - (k - 1) * th * 0.1 * ppl / 1e6 * max(1, 2 - u['doctrine']) < floor(ppl, th): n += 1
    print(f'DEAD_COST {0.1*k:.1f}: strikes back under the floor {n} of {sum(1 for _, r in rows if r["retaliating"])}')

# Option b2: the capital counted on a first strike only with an army in the blast (menShare >= 0.01).
print()
drop = []
for s, r in rows:
    p = r.get('place', {}); u = r['utility']
    if r['retaliating'] or not p.get('capital') or p['menShare'] >= 0.01: continue
    share = p['econShare'] + p['menShare'] - p['ownShare']
    v2 = max(0, min(1, 10 * share)) * u['through']
    if r['u'] - (u['value'] - v2) * u['desperation'] * u['doctrine'] < floor(u['people'], u['through']): drop.append((s, r))
dc10 = sum(civ10(r) for _, r in drop)
print(f'b2 (capital with men share >= 0.01): under the floor {len(drop)} (civ>10x {dc10}, other {len(drop)-dc10}), dead {sum(r["toll"]["dead"] for _, r in drop):,}, men {sum(r["toll"]["men"] for _, r in drop):,}')
