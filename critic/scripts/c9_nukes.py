# Critic run 9: per-seed nuclear history from the headless worlds.
import json,glob
for f in sorted(glob.glob('critic/c9_headless_*.json')):
    d=json.load(open(f)); nl=d['nukeLog']
    tolls=[n for n in nl if n['k']=='toll']; bursts=[n for n in nl if n['k']=='burst']
    if not bursts: print(d['seed'],'none'); continue
    ticks=[b['tick'] for b in bursts]
    first=min(ticks)/8760
    span_days=(max(ticks)-min(ticks))/24
    yrs=sorted(set(b['year'] for b in bursts))
    small=[ (t['by'],t['struck'],t['dead']) for t in tolls if t['dead']<20000]
    print(d['seed'],f"first y{first:.1f} bursts {len(bursts)} years {yrs} span {span_days:.0f}d")
    for t in tolls: print('   ',t['year'],round(t['tick']/24,1),t['by'],'->',t['struck'],t['dead'],'H' if t['yieldN']>1 else 'A', t['at'])
