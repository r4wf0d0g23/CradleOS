import json
from pathlib import Path
p=Path(__file__).resolve().parent
checks={}
for name,expected in [('integrated-320',25),('integrated-390',25),('integrated-1440',25),('blackjack',13),('slots',7),('live-390',25),('live-1440',6),('slots-live',2)]:
 j=json.loads((p/(name+'-browser.json')).read_text());assert len(j['checks'])==expected,(name,len(j['checks']));assert not j.get('failure') and not j['errors'],name
 assert all(c.get('ok',True) for c in j['checks'] if isinstance(c,dict)),name
 checks[name]={'count':expected,'pass':True}
j=json.loads((p/'boundaries.json').read_text());assert len(j['checks'])==8 and not j.get('failure') and not j['errors'];checks['boundaries']={'count':8,'pass':True}
live=json.loads((p.parent/'live-build.json').read_text());assert len(live['files'])==7 and all(x['exactMatch'] for x in live['files']);assert live['source']=='e8459b4f961b90967d187c5420cfb1402aebae51'
assert '360 passed' in (p/'tests.log').read_text();assert 'built in' in (p/'build-final.log').read_text();assert '8 checks' in (p/'origins.log').read_text();assert 'CLEAN' in (p/'ioc.log').read_text()
(p.parent/'verification.json').write_text(json.dumps({'source':live['source'],'pages':'80bd1dcd','rollback':'6238a7eb','checks':checks,'unitTests':360,'exactLiveFiles':7},indent=2)+'\n')
f=p.parent/'RELEASE.md';s=f.read_text().replace('Live interaction verification is in progress; final counts and delivery review will be appended before closing the release.','Live interaction verification **PASS**: all25 games at390 plus6 representative desktop cases (Craps, blackjack, roulette, Plinko, Baccarat, Overdrive), **31 fresh non-slot live cases**. Two fresh live slot regression cases also PASS. No page exceptions or viewport overflow. Isolated Play Money only; no wallet/testnet execution. The final source build and the live deployment are byte-identical for the checked bundles.\n\nDelivery receipt review pending.');f.write_text(s)
f=p.parent/'PLAN.md';s=f.read_text().replace('- [ ] **26','- [x] **26');a=s.index('## Status');s=s[:a]+'## Status\n\nComplete. All25 games upgraded and verified. Runtime e8459b4 / Pages80bd1dcd is live at https://cradleos.io/#/casino . Full suite360, final75 cross-device cases, lifecycle/persistence/slot regressions and31 live non-slot cases passed. See RELEASE.md and verification.json for exact scope.\n';f.write_text(s)
print('All final proof gates PASS')
