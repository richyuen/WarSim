# Critic run 16: checkpoint counts. Same 56 seeds: old = 7739a78 (run 15's c15_ files on c15 saves); head = HEAD on c16
# saves. New 8 seeds: old = c16o files (critic/wt at 7739a78), head = c16. Navy: old = c15n (wt code on c15 saves).
import json, statistics as st, glob
def load(pat):
    out = []
    for f in sorted(glob.glob(pat)): out += json.load(open(f, encoding='utf-8'))
    return out
key = lambda r: (r['seed'], r['bin'][-7:-4] if 'bin' in r else r['file'][-7:-4])
SAME = [1129, 2081, 6421, 7019, 4877, 9437, 1307, 8167, 2347, 3491, 4513, 5683, 6151, 7247, 8011, 8849, 9781, 2953, 3613, 4219,
        5309, 5861, 7583, 8693, 1523, 2671, 3847, 4391, 5147, 6737, 7901, 9203, 1061, 2417, 3253, 4561, 5521, 6833, 7351, 8423,
        1187, 2539, 3359, 4673, 5651, 6967, 7411, 8539, 1213, 2633, 3467, 4789, 5531, 6659, 7723, 8861]
NEW = [1259, 2789, 3571, 4801, 5653, 6703, 7789, 8933]
def paired(o, n, seeds, f):
    ks = [k for k in o if k in n and k[0] in seeds]
    a = [f(o[k]) for k in ks]; b = [f(n[k]) for k in ks]; d = [y - x for x, y in zip(a, b)]
    if not ks: return None
    return dict(n=len(ks), old=round(st.mean(a), 3), head=round(st.mean(b), 3), delta=round(st.mean(d), 3), se=round(st.stdev(d) / len(d) ** 0.5, 3) if len(d) > 1 else 0, lower=sum(1 for x in d if x < 0), higher=sum(1 for x in d if x > 0))
res = {}
eo = {key(r): r for r in load('critic/c15_engaged_w*.json')}; eon = {key(r): r for r in load('critic/c16o_engaged.json')}; en = {key(r): r for r in load('critic/c16_engaged_w*.json')}
m = lambda r: st.mean(r['engagedDaily'])
zero = lambda d, seeds: sum(1 for k, r in d.items() if k[0] in seeds and m(r) == 0)
res['engaged'] = {'same': paired(eo, en, SAME, m), 'sameZero': (zero(eo, SAME), zero(en, SAME)), 'samePerWar': paired(eo, en, SAME, lambda r: m(r) / max(1, r['wars'])),
                  'new': paired(eon, en, NEW, m), 'newZero': (zero(eon, NEW), zero(en, NEW)),
                  'headBest': sorted(((max(r['engagedDaily']), k) for k, r in en.items()), reverse=True)[:5]}
for name, po, pon, pn, fields in [('frag2', 'critic/c15_frag2_*.json', 'critic/c16o_frag2.json', 'critic/c16_frag2_*.json', ['pieces2to400', 'enclaves']),
                                  ('hollow', 'critic/c15_hollow_*.json', 'critic/c16o_hollow.json', 'critic/c16_hollow_*.json', ['land', 'under500', 'under1000', 'meanMen'])]:
    o = {key(r): r for r in load(po)}; on = {key(r): r for r in load(pon)}; n = {key(r): r for r in load(pn)}
    res[name] = {f: {'same': paired(o, n, SAME, lambda r: r[f]), 'new': paired(on, n, NEW, lambda r: r[f])} for f in fields}
no = {key(r): r for r in load('critic/c15n_navy_w*.json')}; non = {key(r): r for r in load('critic/c16o_navy.json')}; nn = {key(r): r for r in load('critic/c16_navy_w*.json')}
nav = {}
for y in ('y10', 'y20'):
    for lab, o, seeds in (('same', no, SAME), ('new', non, NEW)):
        oo = {k: v for k, v in o.items() if k[1] == y}
        for f, fn in (('carriers', lambda r: r['carriers']), ('carriersManned', lambda r: r['carriersManned']), ('fleets', lambda r: r['fleets']),
                      ('tp', lambda r: r['ships'].get('tp', 0)), ('bb', lambda r: r['ships'].get('bb', 0)), ('dd', lambda r: r['ships'].get('dd', 0)), ('ss', lambda r: r['ships'].get('ss', 0)),
                      ('cvNations', lambda r: r['cvNations']), ('trainingCv', lambda r: sum(v for k, v in r['training'].items() if 'cv' in k)),
                      ('trainingAll', lambda r: sum(r['training'].values())), ('trainingTp', lambda r: r['training'].get('tp', 0)), ('worldsNoCarrier', lambda r: 1 if r['carriers'] == 0 else 0)):
            nav[f'{y}_{lab}_{f}'] = paired(oo, nn, seeds, fn)
res['navy'] = nav
print(json.dumps(res, indent=1))
json.dump(res, open('critic/c16_cmp_checkpoints.json', 'w'), indent=1)
