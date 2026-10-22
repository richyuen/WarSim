import json,sys
rows=[json.loads(l) for l in open(sys.argv[1],encoding='utf-8') if l.startswith('{')]
prev=None
for r in rows:
    if r['bursts'] or r.get('gate')=='strike':
        p=(prev or {}).get('place') or {}
        b=(prev or {}).get('best') or {}
        print(r['day'], r['bursts'], 'gate', r.get('gate'), '| prev best u', b.get('u'), 'at', b.get('at'), 'cap', p.get('capital'), 'men', p.get('menShare'), 'people', b.get('people'))
    prev=r
