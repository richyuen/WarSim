# Critic run 11: run 10's 14 seeds on both commits (c10_ files = bcbc99c, c11_ files = HEAD) and the 10 new seeds.
import json, statistics as st
OLD = [1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167, 8693, 9437]
NEW = [1129, 2347, 3491, 4513, 5683, 6151, 7247, 8011, 8849, 9781]
def load(prefix, seed): return json.load(open(f'critic/{prefix}_headless_{seed}.json', encoding='utf-8'))
def stats(prefix, seeds):
    sea1 = []; seal = []; zl = 0; air1 = []; airl = []; bursts = []; stasis = []; living = []; founded = []; flip = []; warsLate = []
    civ10 = 0; lowMil = []; lowHalfMil = []; hLow = 0; nB = 0; restrike = 0; zeroWarYears = 0; aloftLate = []
    for s in seeds:
        d = load(prefix, s); rows = d['rows']; log = d['nukeLog']
        sea = [r['sea']['n'] for r in rows]; sea1.append(sea[0]); seal += sea[1:]; zl += sum(r['sea']['zero'] for r in rows[1:])
        a = [r['ev'].get('AirBattle', 0) for r in rows]; air1.append(a[0]); airl += a[1:]
        aloftLate += [r['meanSortiesAloft'] for r in rows[1:]]
        tops = [tuple(sorted(t.rsplit(' ', 1)[0] for t in r['top'][:5])) for r in rows]
        run = best = 1
        for i in range(1, len(tops)):
            run = run + 1 if tops[i] == tops[i - 1] else 1; best = max(best, run)
        stasis.append(best); living.append(rows[-1]['living']); founded.append(rows[-1]['founded'])
        flip.append(sum(r['flipped'] for r in rows[-5:]) / rows[-1]['landCells'] * 100)
        warsLate += [r['wars'] for r in rows[10:]]; zeroWarYears += sum(1 for r in rows[10:] if r['wars'] <= 1)
        tolls = [n for n in log if n['k'] == 'toll']; forces = [n for n in log if n['k'] == 'forces']; dec = [n for n in log if n['k'] == 'decided']
        places = {}
        for t, fo in zip(tolls, forces):
            nB += 1
            u = next((x['utility'] for x in dec if x['by'] == t['by'] and abs(x['tick'] - t['tick']) < 400 and x['at'] == t['at']), None)
            civ = t['dead'] - fo['men']
            if (fo['men'] > 0 and civ > 10 * fo['men']) or (fo['men'] == 0 and civ > 0): civ10 += 1
            if u is not None and u < 0.1 and civ >= 1_000_000: lowMil.append((s, t['year'], t['by'], t['struck'], t['yieldN'], t['dead'], fo['men'], u))
            if u is not None and u < 0.1 and civ >= 500_000: lowHalfMil.append((s, t['year'], t['by'], t['struck'], t['yieldN'], t['dead'], fo['men'], u))
            key = (round(t['at'][0]), round(t['at'][1]))
            if key in places and t['tick'] - places[key] < 24 * 365: restrike += 1
            places[key] = t['tick']
        bursts.append(len(tolls))
    return dict(worlds=len(seeds), worldsWithBurst=sum(1 for b in bursts if b), bursts=sum(bursts), burstsPerWorld=round(st.mean(bursts), 1),
                sea1=round(st.mean(sea1), 1), seaLatePerWorldYear=round(st.mean(seal), 2), seaLateZeroShare=round(zl / max(1, sum(seal)) * 100, 1),
                air1=round(st.mean(air1)), airLate=round(st.mean(airl)), aloftLate=round(st.mean(aloftLate), 1),
                stasisMax=max(stasis), stasisOver20=sum(1 for x in stasis if x > 20), stasis=stasis, living=(min(living), max(living)), founded=(min(founded), max(founded)),
                late5flip=(round(min(flip), 1), round(max(flip), 1)), warsLateMean=round(st.mean(warsLate), 2), worldYearsLe1War=zeroWarYears,
                civOver10x=civ10, lowUtilMillionCiv=lowMil, lowUtilHalfMillionCiv=lowHalfMil, sameSpotWithinYear=restrike)
out = {'c10_old14': stats('c10', OLD), 'c11_old14': stats('c11', OLD), 'c11_new10': stats('c11', NEW)}
for k, v in out.items():
    print('==', k)
    for kk, vv in v.items(): print('  ', kk, vv)
json.dump(out, open('critic/c11_cmp.json', 'w'), indent=1)
