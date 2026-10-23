import json, glob
def load(p):
    d = {}
    for f in glob.glob(f'critic/{p}_headless_*.json'):
        j = json.load(open(f, encoding='utf-8'))
        d[j['seed']] = {r['year']: r for r in j['rows']}
    return d
a = load('c11'); b = load('c12')
same = sorted(set(a) & set(b)); print(len(same), 'same seeds', same)
tot = [0, 0, 0, 0]
for y in range(1, 31):
    sa = [a[s][y]['sea']['n'] for s in same if y in a[s]]
    sb = [b[s][y]['sea']['n'] for s in same if y in b[s]]
    wa = [a[s][y]['wars'] for s in same if y in a[s]]
    wb = [b[s][y]['wars'] for s in same if y in b[s]]
    if sa and sb:
        print(y, round(sum(sa)/len(sa), 2), round(sum(sb)/len(sb), 2), ' wars', round(sum(wa)/len(wa), 1), round(sum(wb)/len(wb), 1))
        if 2 <= y <= 20:
            tot[0] += sum(sa); tot[1] += len(sa); tot[2] += sum(sb); tot[3] += len(sb)
print('years 2-20', round(tot[0]/tot[1], 2), round(tot[2]/tot[3], 2))
