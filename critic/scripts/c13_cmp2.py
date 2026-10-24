# Critic run 13: checkpoint counts on run 12's 32 seeds, both commits (old = 896ff77 on c12 saves, run in the
# worktree; new = HEAD on c13 saves), and HEAD on run 13's 8 new seeds.
import json, statistics as st, glob
def load(pat):
    out = []
    for f in sorted(glob.glob(pat)): out += json.load(open(f, encoding='utf-8'))
    return out
key = lambda r: (r['seed'], r['bin'][-7:-4])
SAME = [1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167, 8693, 9437, 1129, 2347, 3491, 4513, 5683, 6151, 7247, 8011, 8849, 9781, 1523, 2671, 3847, 4391, 5147, 6737, 7901, 9203]
NEW = [1061, 2417, 3253, 4561, 5521, 6833, 7351, 8423]
engOld = {key(r): r for r in load('critic/c12_engaged_w[123].json') + load('critic/c13_old_engaged_new8.json')}
engNew = {key(r): r for r in load('critic/c13_engaged_*.json')}
def eng(d, seeds):
    rows = [d[k] for k in d if k[0] in seeds]
    m = [st.mean(r['engagedDaily']) for r in rows]
    return dict(checkpoints=len(rows), engagedMean=round(st.mean(m), 2), wars=round(st.mean(r['wars'] for r in rows), 1), landAtWar=round(st.mean(r['landAtWar'] for r in rows)),
                zero=sum(1 for v in m if v == 0), perWar=round(st.mean(st.mean(r['engagedDaily']) / max(1, r['wars']) for r in rows), 3))
pairs = [(k, st.mean(engOld[k]['engagedDaily']), st.mean(engNew[k]['engagedDaily'])) for k in engOld if k in engNew and k[0] in SAME]
res = {'engaged': {'old_same': eng(engOld, SAME), 'new_same': eng(engNew, SAME), 'new_new': eng(engNew, NEW) if any(k[0] in NEW for k in engNew) else None,
                   'pairs': len(pairs), 'higher': sum(1 for _, a, b in pairs if b > a), 'lower': sum(1 for _, a, b in pairs if b < a)}}
def y20(pat): return {r['seed']: r for r in load(pat) if r['bin'].endswith('y20.bin')}
for name, po, pn, fields in [('frag2', 'critic/c13_old_frag2_*.json', 'critic/c13_frag2_*.json', ['pieces2to400', 'enclaves', 'enclavesAtPeace', 'enclavesAtWar', 'cellsInThem']),
                             ('hollow', 'critic/c13_old_hollow_*.json', 'critic/c13_hollow_*.json', ['land', 'under500', 'under1000', 'under500AtWar', 'meanMen'])]:
    o = y20(po); n = y20(pn); both = [s for s in SAME if s in o and s in n]
    r = {'seeds': len(both)}
    for f in fields:
        r[f] = (round(st.mean(o[s][f] for s in both), 1), round(st.mean(n[s][f] for s in both), 1), sum(1 for s in both if n[s][f] > o[s][f]))
    nn = [s for s in NEW if s in n]
    if nn: r['newSeeds'] = {f: round(st.mean(n[s][f] for s in nn), 1) for f in fields}
    res[name] = r
c11 = {r['seed']: r['pieces2to400'] for r in json.load(open('critic/c11_frag_head.json')) if r['bin'].endswith('y20.bin')}
n = y20('critic/c13_frag2_*.json'); both = [s for s in c11 if s in n]
res['frag_vs_dd3b730'] = {'seeds': len(both), 'dd3b730': round(st.mean(c11[s] for s in both), 1), 'head': round(st.mean(n[s]['pieces2to400'] for s in both), 1), 'headAbove': sum(1 for s in both if n[s]['pieces2to400'] > c11[s])}
print(json.dumps(res, indent=1))
json.dump(res, open('critic/c13_cmp_checkpoints.json', 'w'), indent=1)
