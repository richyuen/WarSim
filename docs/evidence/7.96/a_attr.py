# PLAN 7.96a: the inputs set back by the old world's (first part reads the worktrees' full rows), and the TABOO_AFTER table.
import json, statistics as st
FLOOR=0.025
for s in [2953,3613]:
    o=json.load(open(f'C:/Git/WarSim_old/.cache/nr_{s}.json')); r=json.load(open(f'C:/Git/WarSim_rule/.cache/nr_{s}.json'))
    print(f'== {s}: bursts old {o["bursts"]} rule {r["bursts"]}; gain>floor days {o["gainOver"]} -> {r["gainOver"]}; u>floor {o["uOver"]} -> {r["uOver"]}')
    for name,src in (('old weighed',o['means']),):
        pass
    om=lambda k: st.mean(x[k] for x in o['rows']) if o['rows'] else o['means'][k]
    print('  over-floor-gain rows, means old -> rule:', {k:(round(om(k),3), round(st.mean(x[k] for x in r['rows']),3)) for k in ['value','desperation','doctrine','through','taboo','retaliation','outrage','alliance','dead','gain','u']})
    over=[x for x in r['rows'] if x['u']>FLOOR]
    print('  rule days u>floor:', len(over), 'reasons', {k:sum(1 for x in over if x['reason']==k) for k in set(x['reason'] for x in over)})
    for k in ['taboo','desperation','value','through']:
        ref=om(k)
        drop=0
        for x in over:
            if k=='taboo': u2=x['u']-max(0,ref-x['taboo'])
            elif k in ('desperation','value'):
                g2=x['gain']*min(1,ref/x[k]) if x[k]>0 else x['gain']; u2=x['u']-x['gain']+g2
            else:
                u2=x['u']-x['gain']*(1-min(1,ref/x[k])) if x[k]>0 else x['u']
            if u2<=FLOOR: drop+=1
        print(f'   {k} set to old over-floor mean {ref:.3f} (capped, only lowered): {drop} of {len(over)} fall under the floor')
    # first over-floor day per war
    first={}
    for x in over:
        first.setdefault(x['war'],x)
    print('  first u>floor day per war:', [(x['day'],x['n'],round(x['u'],3),round(x['taboo'],3),round(x['desperation'],3),round(x['value'],3)) for x in first.values()])

# The strike days with TABOO_AFTER raised (a.md's last table), from the committed rows.
REC = 0.0005
st = []
for s in [2953, 3613]:
    r = json.load(open(f'docs/evidence/7.96/a-rule-nr_{s}.json'))
    st += [x for x in r['rows'] if x['reason'] == 'strikes']
for after in [0.3, 0.5, 0.6, 0.7, 0.8, 1.0]:
    keep = 0
    for x in st:
        tw = x['tabooWorld']
        t2 = 1.0 if tw >= 0.999 else min(1.0, after + (tw - 0.3))  # the days since the break kept
        ext = x['taboo'] < 0.75 * x['through'] * 0.6 * tw
        cost2 = x['through'] * 0.6 * t2 * (0.5 if ext else 1)
        keep += x['u'] - (cost2 - x['taboo']) > FLOOR
    print(f'TABOO_AFTER {after}: strike days kept {keep} of {len(st)}')
