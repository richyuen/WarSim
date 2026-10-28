# Critic run 17: same-seed comparison, 7b883084 (c16_ files of run 16; c17o_ for the 8 new seeds) -> HEAD cfedb50a (c17_).
# Paired per-seed metrics with the standard error of the mean difference.
import json, os, statistics as st, sys
SAME = [1129, 2081, 6421, 7019, 4877, 9437, 1307, 8167, 2347, 3491, 4513, 5683, 6151, 7247, 8011, 8849, 9781, 2953, 3613, 4219,
        5309, 5861, 7583, 8693, 1523, 2671, 3847, 4391, 5147, 6737, 7901, 9203, 1061, 2417, 3253, 4561, 5521, 6833, 7351, 8423,
        1187, 2539, 3359, 4673, 5651, 6967, 7411, 8539, 1213, 2633, 3467, 4789, 5531, 6659, 7723, 8861]
SAME += [1259, 2789, 3571, 4801, 5653, 6703, 7789, 8933]
NEW = [1607, 2213, 3727, 4493, 5419, 6301, 7129, 8273]
YEARS = int(sys.argv[1]) if len(sys.argv) > 1 else 30
def load(p, s):
    f = f'critic/{p}_headless_{s}.json'
    if not os.path.exists(f): return None
    d = json.load(open(f, encoding='utf-8'))
    return d if d['years'] >= YEARS else None
def metrics(d):
    rows = d['rows'][:YEARS]; log = d['nukeLog']
    m = {}
    m['eng1'] = rows[0]['engagedMean']
    m['engLate'] = st.mean(r['engagedMean'] for r in rows[1:])
    m['engPerAtWarLatePct'] = 100 * st.mean(r['engagedMean'] / max(1, r['landAtWarMean']) for r in rows[1:])
    m['engPerWarLate'] = st.mean(r['engagedMean'] / max(1, r['wars']) for r in rows[1:])
    m['sea1'] = rows[0]['sea']['n']
    m['seaLate'] = st.mean(r['sea']['n'] for r in rows[1:])
    m['seaZeroLatePct'] = 100 * sum(r['sea']['zero'] for r in rows[1:]) / max(1, sum(r['sea']['n'] for r in rows[1:]))
    m['sunkLate'] = st.mean(r['sea']['sunk'] for r in rows[1:])
    m['air1'] = rows[0]['ev'].get('AirBattle', 0)
    m['airLate'] = st.mean(r['ev'].get('AirBattle', 0) for r in rows[1:])
    m['aloft1'] = rows[0]['meanSortiesAloft']
    m['aloftLate'] = st.mean(r['meanSortiesAloft'] for r in rows[1:])
    m['wingsY20'] = rows[min(19, len(rows) - 1)]['wings']
    m['wingsLate'] = st.mean(r['wings'] for r in rows[1:])
    m['warsLate'] = st.mean(r['wars'] for r in rows[1:])
    tops = [tuple(sorted(t.rsplit(' ', 1)[0] for t in r['top'][:5])) for r in rows]
    run = best = 1
    for i in range(1, len(tops)):
        run = run + 1 if tops[i] == tops[i - 1] else 1; best = max(best, run)
    m['stasis'] = best
    def longest(key):
        b = r_ = 0
        for i in range(len(rows)):
            r_ = r_ + 1 if i > 0 and key(rows[i]) == key(rows[i - 1]) else 1; b = max(b, r_)
        return b
    m['stasisOrdered'] = longest(lambda r: tuple(t.rsplit(' ', 1)[0] for t in r['top'][:5]))
    if 'strong5' in rows[0]: m['stasisStrong'] = longest(lambda r: tuple(sorted(r['strong5'])))
    if 'navy' in rows[0]:
        for yy in (10, 20, 30):
            if len(rows) >= yy:
                for k2 in ('transports', 'carriers', 'manned', 'warships'): m[f'navy{yy}_{k2}'] = rows[yy - 1]['navy'][k2]
        m['cvAirLate'] = st.mean(r['cvAirH'] for r in rows[1:]); m['cvStrikeLate'] = st.mean(r['cvStrikeH'] for r in rows[1:])
    m['largestPct30'] = float(rows[-1]['top'][0].rsplit(' ', 1)[1].rstrip('%'))
    m['flipLatePctMin'] = min(r['flipped'] for r in rows[1:]) / rows[-1]['landCells'] * 100
    m['flipLast5Pct'] = sum(r['flipped'] for r in rows[-5:]) / rows[-1]['landCells'] * 100
    tolls = [n for n in log if n['k'] == 'toll' and n['year'] <= YEARS]; forces = [n for n in log if n['k'] == 'forces' and n['year'] <= YEARS]
    m['bursts'] = len(tolls)
    civM = 0; civ10 = 0
    for t, fo in zip(tolls, forces):
        civ = t['dead'] - fo['men']
        if civ >= 1_000_000: civM += 1
        if (fo['men'] > 0 and civ > 10 * fo['men']) or (fo['men'] == 0 and civ > 0): civ10 += 1
    m['burstsCivOver1M'] = civM; m['burstsCiv10x'] = civ10
    for k in ('WarDeclared', 'RevoltSpawned', 'PuppetCreated', 'NationAnnexed', 'CapitalCaptured', 'CapitalMoved', 'ConvoyRaided', 'FormationEmbarked', 'FormationLanded', 'LandingRepulsed', 'MajorBattleStarted', 'PeaceSigned', 'FleetsLaidUp', 'AirStrike', 'StrikeHit'):
        m['ev_' + k] = sum(r['ev'].get(k, 0) for r in rows)
    m['tickMeanLate'] = st.mean(r['tickMs'] for r in rows[1:])
    m['tickMax'] = max(r['tickMs'] for r in rows)
    m['living30'] = rows[-1]['living']
    return m
def paired(pa, pb, seeds):
    used = [s for s in seeds if load(pa, s) and load(pb, s)]
    A = {s: metrics(load(pa, s)) for s in used}; B = {s: metrics(load(pb, s)) for s in used}
    out = {'n': len(used), 'seeds': used}
    for k in [k for k in A[used[0]] if all(k in A[s] and k in B[s] for s in used)] if used else []:
        a = [A[s][k] for s in used]; b = [B[s][k] for s in used]; d = [y - x for x, y in zip(a, b)]
        se = st.stdev(d) / len(d) ** 0.5 if len(d) > 1 else 0
        out[k] = dict(old=round(st.mean(a), 3), head=round(st.mean(b), 3), delta=round(st.mean(d), 3), se=round(se, 3), lower=sum(1 for x in d if x < 0), higher=sum(1 for x in d if x > 0))
    out['stasisOver12'] = (sum(1 for s in used if A[s]['stasis'] > 12), sum(1 for s in used if B[s]['stasis'] > 12))
    for k in ('stasisOrdered', 'stasisStrong'):
        if used and all(k in A[s] and k in B[s] for s in used): out[k + 'Over12'] = (sum(1 for s in used if A[s][k] > 12), sum(1 for s in used if B[s][k] > 12)); out[k + 'Max'] = (max(A[s][k] for s in used), max(B[s][k] for s in used))
    out['stasisMax'] = (max(A[s]['stasis'] for s in used), max(B[s]['stasis'] for s in used)) if used else None
    return out
res = {'years': YEARS, 'same': paired('c16', 'c17', SAME), 'new': paired('c17o', 'c17', NEW)}
headOnly = {s: metrics(load('c17', s)) for s in SAME + NEW if load('c17', s)}
res['headOnly'] = {k: {'n': len(headOnly), 'over12': sum(1 for v in headOnly.values() if v.get(k, 0) > 12), 'max': max((v.get(k, 0) for v in headOnly.values()), default=0), 'worst': sorted(((v.get(k, 0), s) for s, v in headOnly.items()), reverse=True)[:5]} for k in ('stasis', 'stasisOrdered', 'stasisStrong')}
res['headOnly']['largest30Over33'] = sorted((v['largestPct30'], s) for s, v in headOnly.items() if v['largestPct30'] > 33)
print(json.dumps(res['headOnly']))
for g in ('same', 'new'):
    r = res[g]; print(f"== {g} n={r['n']}")
    for k, v in r.items():
        if isinstance(v, dict): print(f"  {k:24s} {v['old']:>10} -> {v['head']:>10}  d={v['delta']:>9} se={v['se']:>7}  lower {v['lower']} higher {v['higher']}")
    print('  stasisOver12', r.get('stasisOver12'), 'stasisMax', r.get('stasisMax'), 'ordered', r.get('stasisOrderedOver12'), r.get('stasisOrderedMax'), 'strong', r.get('stasisStrongOver12'), r.get('stasisStrongMax'))
json.dump(res, open(f'critic/c17_cmp_y{YEARS}.json', 'w'), indent=1)
