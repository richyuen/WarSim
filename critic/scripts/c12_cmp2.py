# Critic run 12: engagement and fragmentation at the y10/y20 checkpoints, run 11's 24 seeds on both commits
# (c11_*_head.json = dd3b730, c12_*_w*.json = HEAD); and the idle piles at y10.
import json, statistics as st
a = {(r['seed'], r['bin'][-7:-4]): r for r in json.load(open('critic/c11_engaged_head.json'))}
b = sum((json.load(open(f'critic/c12_engaged_w{i}.json')) for i in (1, 2, 3)), [])
x = []; y = []; wx = []; wy = []; lx = []; ly = []; rows = []
for r in b:
    k = (r['seed'], r['bin'][-7:-4]); o = a[k]
    x.append(st.mean(o['engagedDaily'])); y.append(st.mean(r['engagedDaily'])); wx.append(o['wars']); wy.append(r['wars']); lx.append(o['landAtWar']); ly.append(r['landAtWar'])
    rows.append([k[0], k[1], o['wars'], o['landAtWar'], round(x[-1], 2), r['wars'], r['landAtWar'], round(y[-1], 2)])
fa = {r['seed']: r for r in json.load(open('critic/c11_frag_head.json')) if r['bin'].endswith('y20.bin')}
fb = json.load(open('critic/c12_frag_head_w12.json')) + json.load(open('critic/c12_frag_head_w3.json'))
fr = [(r['seed'], fa[r['seed']]['pieces2to400'], r['pieces2to400'], fa[r['seed']]['worst'][0], r['worst'][0]) for r in fb]
out = dict(
    engaged=dict(checkpoints=len(b), c11=round(st.mean(x), 2), c12=round(st.mean(y), 2), warsC11=round(st.mean(wx), 1), warsC12=round(st.mean(wy), 1),
                 landAtWarC11=round(st.mean(lx)), landAtWarC12=round(st.mean(ly)), zeroC11=sum(1 for v in x if v == 0), zeroC12=sum(1 for v in y if v == 0),
                 higher=sum(1 for p, q in zip(x, y) if q > p), lower=sum(1 for p, q in zip(x, y) if q < p), rows=rows),
    frag=dict(seeds=len(fr), c11=round(st.mean(f[1] for f in fr)), c12=round(st.mean(f[2] for f in fr)), worse=sum(1 for f in fr if f[2] > f[1]), start1938=469, rows=fr))
print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk != 'rows'} for k, v in out.items()}, indent=1))
json.dump(out, open('critic/c12_cmp_checkpoints.json', 'w'), indent=1)
