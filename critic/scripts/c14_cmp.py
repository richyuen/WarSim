# Critic run 14: run 13's 40 seeds on both commits (c13_ files = 0c80db1, c14_ files = HEAD) and 8 new seeds (c14o_ = 0c80db1).
import json, statistics as st
import os
OLD = [1307, 2081, 2953, 3613, 4219, 4877, 5309, 5861, 6421, 7019, 7583, 8167, 8693, 9437, 1129, 2347, 3491, 4513, 5683, 6151, 7247, 8011, 8849, 9781, 1523, 2671, 3847, 4391, 5147, 6737, 7901, 9203, 1061, 2417, 3253, 4561, 5521, 6833, 7351, 8423]
NEW = [1187, 2539, 3359, 4673, 5651, 6967, 7411, 8539]
OLD = [s for s in OLD if os.path.exists(f'critic/c14_headless_{s}.json') and json.load(open(f'critic/c14_headless_{s}.json'))['years'] == 30]
NEW = [s for s in NEW if all(os.path.exists(f'critic/{p}_headless_{s}.json') and json.load(open(f'critic/{p}_headless_{s}.json'))['years'] == 30 for p in ('c14','c14o'))]
def load(prefix, seed): return json.load(open(f'critic/{prefix}_headless_{seed}.json', encoding='utf-8'))
def stats(prefix, seeds):
    sea1 = []; seal = []; zl = 0; air1 = []; airl = []; bursts = []; stasis = []; living = []; founded = []; flip = []; warsLate = []
    engLate = []; eng1 = []; engRatio = []
    snap = {10: [], 20: [], 30: []}; evc = {}
    civ10 = 0; lowMil = []; lowHalfMil = []; hLow = 0; nB = 0; restrike = 0; zeroWarYears = 0; aloftLate = []
    for s in seeds:
        d = load(prefix, s); rows = d['rows']; log = d['nukeLog']
        sea = [r['sea']['n'] for r in rows]; sea1.append(sea[0]); seal += sea[1:]; zl += sum(r['sea']['zero'] for r in rows[1:])
        a = [r['ev'].get('AirBattle', 0) for r in rows]; air1.append(a[0]); airl += a[1:]
        aloftLate += [r['meanSortiesAloft'] for r in rows[1:]]
        for Y in (10, 20, 30): snap[Y].append((rows[Y-1]['living'], rows[Y-1]['founded'], rows[Y-1]['tiny']))
        for r in rows:
            for k in ('WarDeclared', 'RevoltSpawned', 'CapitalCaptured', 'CapitalMoved', 'NationRevived', 'PuppetCreated', 'UnionFormed', 'NationAnnexed'): evc[k] = evc.get(k, 0) + r['ev'].get(k, 0)
        if 'engagedMean' in rows[0]:
            eng1.append(rows[0]['engagedMean']); engLate += [r['engagedMean'] for r in rows[1:]]
            engRatio += [r['engagedMean'] / max(1, r['landAtWarMean']) for r in rows[1:]]
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
                air1=round(st.mean(air1)), eng1=round(st.mean(eng1),2) if eng1 else None, engLate=round(st.mean(engLate),2) if engLate else None, engLateShareOfLandAtWarPct=round(100*st.mean(engRatio),2) if engRatio else None, airLate=round(st.mean(airl)), aloftLate=round(st.mean(aloftLate), 1),
                stasisMax=max(stasis), stasisOver20=sum(1 for x in stasis if x > 20), stasis=stasis, living=(min(living), max(living)), founded=(min(founded), max(founded)),
                late5flip=(round(min(flip), 1), round(max(flip), 1)), warsLateMean=round(st.mean(warsLate), 2), worldYearsLe1War=zeroWarYears,
                civOver10x=civ10, livingFoundedTinyMean={Y: tuple(round(st.mean(v[i]), 1) for i in range(3)) for Y, v in ((Y, list(zip(*snap[Y]))) for Y in snap)}, eventsPerWorld={k: round(v / len(seeds), 1) for k, v in evc.items()}, lowUtilMillionCiv=lowMil, lowUtilHalfMillionCiv=lowHalfMil, sameSpotWithinYear=restrike)
out = {'old_same': stats('c13', OLD), 'head_same': stats('c14', OLD), 'old_new': stats('c14o', NEW) if NEW else None, 'head_new': stats('c14', NEW) if NEW else None, 'seedsSame': OLD, 'seedsNew': NEW}
for k, v in out.items():
    print('==', k)
    if isinstance(v, dict):
        for kk, vv in v.items(): print('  ', kk, vv)
    else: print('  ', v)
json.dump(out, open('critic/c14_cmp.json', 'w'), indent=1)
