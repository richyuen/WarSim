# Critic run 15: bursts killing over a million civilians, and with 0 men, per commit on the same 48 seeds (+8 new both).
import json, glob
SAME = [1307,2081,2953,3613,4219,4877,5309,5861,6421,7019,7583,8167,8693,9437,1129,2347,3491,4513,5683,6151,7247,8011,8849,9781,1523,2671,3847,4391,5147,6737,7901,9203,1061,2417,3253,4561,5521,6833,7351,8423,1187,2539,3359,4673,5651,6967,7411,8539]
NEW = [1213,2633,3467,4789,5531,6659,7723,8861]
def bursts(p, seeds):
    R = []
    for s in seeds:
        d = json.load(open(f'critic/{p}_headless_{s}.json')); log = d['nukeLog']
        tolls = [n for n in log if n['k'] == 'toll']; forces = [n for n in log if n['k'] == 'forces']; dec = [n for n in log if n['k'] == 'decided']
        for t, fo in zip(tolls, forces):
            u = next((x['utility'] for x in dec if x['by'] == t['by'] and abs(x['tick'] - t['tick']) < 400 and x['at'] == t['at']), None)
            R.append(dict(seed=s, year=t['year'], by=t['by'], struck=t['struck'], yieldN=t['yieldN'], civ=t['dead'] - fo['men'], men=fo['men'], utility=u, at=t['at']))
    return R
out = {}
for tag, p, seeds in (('old_same', 'c14', SAME), ('head_same', 'c15', SAME), ('old_new', 'c15o', NEW), ('head_new', 'c15', NEW)):
    R = bursts(p, seeds)
    out[tag] = dict(bursts=len(R), overMillionCiv=sum(1 for r in R if r['civ'] > 1_000_000), zeroMenCiv=sum(1 for r in R if r['men'] == 0 and r['civ'] > 0),
                    over100kCivUnder5kMen=sum(1 for r in R if r['civ'] > 100_000 and r['men'] < 5000), worst=sorted(R, key=lambda r: -r['civ'])[:5])
    print(tag, {k: v for k, v in out[tag].items() if k != 'worst'})
json.dump(out, open('critic/c15_nukeciv.json', 'w'), indent=1)
