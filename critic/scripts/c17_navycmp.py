# Critic run 17: navy census at years 10 and 20, same seeds: 7b883084 (run 16's c16_navy_w*.json on c16 saves) -> HEAD
# (c17 headless rows' year-end census).
import json, glob, statistics as st
old = {}
for f in glob.glob('critic/c16_navy_w*.json'):
    for r in json.load(open(f)): old[(r['seed'], int(r['file'][-6:-4]))] = r
res = {}
for yy in (10, 20):
    for k, fo, fn in (('transports', lambda r: r['ships'].get('tp', 0), lambda n: n['transports']), ('carriers', lambda r: r['carriers'], lambda n: n['carriers']), ('manned', lambda r: r['carriersManned'], lambda n: n['manned'])):
        a = []; b = []
        for (s, y), r in old.items():
            if y != yy: continue
            try: d = json.load(open(f'critic/c17_headless_{s}.json'))
            except FileNotFoundError: continue
            a.append(fo(r)); b.append(fn(d['rows'][yy - 1]['navy']))
        dd = [y - x for x, y in zip(a, b)]
        res[f'y{yy}_{k}'] = dict(n=len(a), old=round(st.mean(a), 2), head=round(st.mean(b), 2), se=round(st.stdev(dd) / len(dd) ** 0.5, 2), lower=sum(x < 0 for x in dd), higher=sum(x > 0 for x in dd))
        print(yy, k, res[f'y{yy}_{k}'])
json.dump(res, open('critic/c17_navycmp.json', 'w'), indent=1)
