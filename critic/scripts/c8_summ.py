import json,glob,sys
files=sorted(glob.glob('critic/c8_headless_*.json'))
tot_dec=0;tot_burst=0;seeds_with=0
for f in files:
    d=json.load(open(f));rows=d['rows'];nl=d['nukeLog']
    dec=sum(r['ev'].get('NukeDecided',0) for r in rows); burst=sum(r['ev'].get('NukeDetonated',0) for r in rows)
    lau=sum(r['ev'].get('NukeLaunched',0) for r in rows); icp=sum(r['ev'].get('NukeIntercepted',0) for r in rows)
    tot_dec+=dec;tot_burst+=burst;seeds_with+= burst>0
    last=rows[-1]
    late=rows[-5:]; fl=sum(r['flipped'] for r in late); land=last['landCells']
    wars=[r['wars'] for r in rows]
    wh=sum(last['warheads'].values()); nwh=len(last['warheads'])
    print(f"{d['seed']:>5} y{d['years']} dec{dec} launch{lau} icpt{icp} burst{burst} | wh {wh} in {nwh} | living {last['living']} founded {last['founded']} | late5 flip {100*fl/land:.1f}% | wars {wars[-10:]} | top {last['top'][:3]} | maxMs {max(r['maxMs'] for r in rows)} aloft {[r['meanSortiesAloft'] for r in rows[::5]]}")
print('total decided',tot_dec,'bursts',tot_burst,'seeds with burst',seeds_with,'of',len(files))
