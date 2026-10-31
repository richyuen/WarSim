# Critic run 21: yearly hashes on HEAD against run 20's (c20_headless_<seed>.json).
import json, sys
res = {}
for s in ('1213', '3301'):
    a = json.load(open(f'critic/c20_headless_{s}.json', encoding='utf-8'))
    b = json.load(open(f'critic/c21_headless_{s}.json', encoding='utf-8'))
    def hs(o):
        ys = o['rows']
        return [(y.get('year'), y.get('hash')) for y in ys]
    ha, hb = hs(a), hs(b)
    n = min(len(ha), len(hb))
    res[s] = {'compared': n, 'equal': sum(1 for i in range(n) if ha[i] == hb[i]), 'last': [ha[n-1] if n else None, hb[n-1] if n else None]}
print(json.dumps(res))
json.dump(res, open('critic/c21_ident.json', 'w'), indent=1)
