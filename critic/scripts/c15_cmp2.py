# Critic run 15: checkpoint counts on run 13's 40 seeds, both commits (old = 311988d on c14 saves, run 13's files;
# new = HEAD on c15 saves), and the 8 new seeds on both (old = c15o files from critic/wt at 311988d).
# Also the daily engaged-per-war figure from the 30-year rows (run 13's 0.57), same seeds both commits.
import json, statistics as st, glob, os
def load(pat):
    out = []
    for f in sorted(glob.glob(pat)): out += json.load(open(f, encoding='utf-8'))
    return out
key = lambda r: (r['seed'], r['bin'][-7:-4])
SAME = [1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167, 8693, 9437, 1129, 2347, 3491, 4513, 5683, 6151, 7247, 8011, 8849, 9781, 1523, 2671, 3847, 4391, 5147, 6737, 7901, 9203, 1061, 2417, 3253, 4561, 5521, 6833, 7351, 8423, 1187, 2539, 3359, 4673, 5651, 6967, 7411, 8539]
NEW = [1213, 2633, 3467, 4789, 5531, 6659, 7723, 8861]
engOld = {key(r): r for r in load('critic/c14_engaged_w*.json')}
engOldNew = {key(r): r for r in load('critic/c15o_engaged.json')}
engNew = {key(r): r for r in load('critic/c15_engaged_w*.json')}
def eng(d, seeds):
    rows = [d[k] for k in d if k[0] in seeds]
    if not rows: return None
    m = [st.mean(r['engagedDaily']) for r in rows]
    return dict(checkpoints=len(rows), engagedMean=round(st.mean(m), 2), wars=round(st.mean(r['wars'] for r in rows), 1), landAtWar=round(st.mean(r['landAtWar'] for r in rows)),
                zero=sum(1 for v in m if v == 0), perWar=round(st.mean(st.mean(r['engagedDaily']) / max(1, r['wars']) for r in rows), 3), maxDaily=max(max(r['engagedDaily']) for r in rows))
def pairs(o, n, seeds):
    p = [(k, st.mean(o[k]['engagedDaily']), st.mean(n[k]['engagedDaily'])) for k in o if k in n and k[0] in seeds]
    return dict(pairs=len(p), higher=sum(1 for _, a, b in p if b > a), lower=sum(1 for _, a, b in p if b < a))
res = {'engaged': {'old_same': eng(engOld, SAME), 'head_same': eng(engNew, SAME), **{'same_' + k: v for k, v in pairs(engOld, engNew, SAME).items()},
                   'old_new': eng(engOldNew, NEW), 'head_new': eng(engNew, NEW), **{'new_' + k: v for k, v in pairs(engOldNew, engNew, NEW).items()}}}
best = sorted(((max(r['engagedDaily']), k) for k, r in engNew.items()), reverse=True)[:6]
res['engaged']['headBestCheckpoints'] = best
def y20(pat): return {r['seed']: r for r in load(pat) if r['bin'].endswith('y20.bin')}
for name, po, pon, pn, fields in [('frag2', 'critic/c14_frag2_*.json', 'critic/c15o_frag2.json', 'critic/c15_frag2_*.json', ['pieces2to400', 'enclaves', 'enclavesAtPeace', 'enclavesAtWar', 'cellsInThem']),
                                  ('hollow', 'critic/c14_hollow_*.json', 'critic/c15o_hollow.json', 'critic/c15_hollow_*.json', ['land', 'under500', 'under1000', 'under500AtWar', 'meanMen'])]:
    o = y20(po); on = y20(pon); n = y20(pn)
    r = {}
    for tag, oo, seeds in (('same', o, SAME), ('new', on, NEW)):
        both = [s for s in seeds if s in oo and s in n]
        rr = {'seeds': len(both)}
        for f in fields:
            if both: rr[f] = (round(st.mean(oo[s][f] for s in both), 1), round(st.mean(n[s][f] for s in both), 1), sum(1 for s in both if n[s][f] > oo[s][f]))
        r[tag] = rr
    res[name] = r
c11 = {r['seed']: r['pieces2to400'] for r in json.load(open('critic/c11_frag_head.json')) if r['bin'].endswith('y20.bin')}
n = y20('critic/c15_frag2_*.json'); both = [s for s in c11 if s in n]
res['frag_vs_dd3b730'] = {'seeds': len(both), 'dd3b730': round(st.mean(c11[s] for s in both), 1), 'head': round(st.mean(n[s]['pieces2to400'] for s in both), 1), 'headAbove': sum(1 for s in both if n[s]['pieces2to400'] > c11[s])}
# daily engaged per war from the 30-year rows (sampled daily in the run), years 2-30 and year 1
def perwar(prefix, seeds):
    y1 = []; late = []; lateAll = []; y1All = []
    for s in seeds:
        f = f'critic/{prefix}_headless_{s}.json'
        if not os.path.exists(f): continue
        rows = json.load(open(f))['rows']
        if len(rows) < 30: continue
        y1.append(rows[0]['engagedMean'] / max(1, rows[0]['wars'])); y1All.append(rows[0]['engagedMean'])
        late += [r['engagedMean'] / max(1, r['wars']) for r in rows[1:]]; lateAll += [r['engagedMean'] for r in rows[1:]]
    if not y1: return None
    return dict(worlds=len(y1), perWarY1=round(st.mean(y1), 2), perWarLate=round(st.mean(late), 3), engagedY1=round(st.mean(y1All), 2), engagedLate=round(st.mean(lateAll), 2), lateShareOfY1Pct=round(100 * st.mean(lateAll) / st.mean(y1All), 1))
res['perWar'] = {'old_same': perwar('c14', SAME), 'head_same': perwar('c15', SAME), 'old_new': perwar('c15o', NEW), 'head_new': perwar('c15', NEW)}
print(json.dumps(res, indent=1))
json.dump(res, open('critic/c15_cmp_checkpoints.json', 'w'), indent=1)
