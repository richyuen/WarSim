# Critic run 11: summary of the 14 headless 30-year worlds.
import json, glob, statistics as st
files = sorted(glob.glob('critic/c11_headless_*.json'))
allb = []
sea1 = []; sealate = []; zl = 0; nl = 0; air1 = []; airlate = []
for f in files:
    d = json.load(open(f, encoding='utf-8')); rows = d['rows']; log = d['nukeLog']
    seed = d['seed']; last = rows[-1]
    burst = sum(r['ev'].get('NukeDetonated', 0) for r in rows)
    tolls = [n for n in log if n['k'] == 'toll']; forces = [n for n in log if n['k'] == 'forces']; dec = [n for n in log if n['k'] == 'decided']
    # top-5 stasis: longest run of identical top-5 sets
    tops = [tuple(sorted(t.split(' ')[0] if False else t.rsplit(' ', 1)[0] for t in r['top'][:5])) for r in rows]
    run = best = 1
    for i in range(1, len(tops)):
        run = run + 1 if tops[i] == tops[i - 1] else 1; best = max(best, run)
    land = last['landCells']; late = rows[-5:]
    flip = sum(r['flipped'] for r in late) / land * 100
    s = [r['sea']['n'] for r in rows]; z = [r['sea']['zero'] for r in rows]; sunk = [r['sea']['sunk'] for r in rows]
    a = [r['ev'].get('AirBattle', 0) for r in rows]
    sea1.append(s[0]); sealate += s[1:]; zl += sum(z[1:]); nl += sum(s[1:]); air1.append(a[0]); airlate += a[1:]
    print(f"{seed} y{d['years']} bursts {burst} wars(last10) {[r['wars'] for r in rows[-10:]]} living {last['living']} founded {last['founded']} late5flip {flip:.1f}% stasis {best}y")
    print(f"   sea/yr {s} zero {sum(z)} sunk {sum(sunk[1:])} after y1 | air y1 {a[0]} later mean {st.mean(a[1:]):.0f} | aloft {[r['meanSortiesAloft'] for r in rows[::5]]}")
    print(f"   top {last['top'][:5]} warheads {last['warheads']}")
    for t, fo in zip(tolls, forces):
        u = next((x['utility'] for x in dec if x['by'] == t['by'] and abs(x['tick'] - t['tick']) < 400 and x['at'] == t['at']), None)
        allb.append((seed, t['year'], t['by'], t['struck'], t['yieldN'], t['dead'], fo['men'], u))
        print(f"     y{t['year']} {t['by']} -> {t['struck']} {'H' if t['yieldN'] > 1 else 'A'} dead {t['dead']:,} men {fo['men']:,} util {u} at {[round(v,1) for v in t['at']]}")
print('worlds with a burst', len({b[0] for b in allb}), 'of', len(files), 'bursts', len(allb))
print('sea battles: year 1 mean', st.mean(sea1), 'later mean/world-year', round(st.mean(sealate), 2), 'zero-loss later', zl, 'of', nl)
print('air battles: year 1 mean', round(st.mean(air1)), 'later mean', round(st.mean(airlate)))
civ = [(b[5] - b[6], b) for b in allb]
print('strikes where civilians > 10x soldiers:', sum(1 for c, b in civ if b[6] > 0 and c > 10 * b[6] or b[6] == 0 and c > 0))
print('low-utility (<0.1) strikes:', [(b[0], b[2], b[3], 'H' if b[4] > 1 else 'A', b[5], b[6], b[7]) for b in allb if b[7] is not None and b[7] < 0.1])
