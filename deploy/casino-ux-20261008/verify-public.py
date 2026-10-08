from pathlib import Path
import urllib.request,urllib.error,json,hashlib,concurrent.futures,os,time
root=Path('/home/rawdata/.openclaw-captain/workspace/worktrees/cradleos-cycle7-20261002/deploy/casino-ux-20261008')
deployment=os.environ['DEPLOYMENT'];source=os.environ['SOURCE_SHA']
base='https://cradleos.io';immutable=f'https://{deployment}.cradleos-d75.pages.dev'
assets=json.loads((root/'assets-preserved.json').read_text());bundle=json.loads((root/'bundle-hashes.json').read_text())
def get(url):
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CradleOS-Casino-Release-Verification/1.0','Cache-Control':'no-cache'}),timeout=30) as r:return r.read(),dict(r.headers)
  except (TimeoutError,urllib.error.URLError) as e:
   if isinstance(e,urllib.error.HTTPError) and e.code<500:raise
   if attempt==2:raise
   print('Transient read retry',attempt+1,url,flush=True)
   time.sleep(1)
def verify(job):
 url,want=job;b,h=get(url);actual=hashlib.sha256(b).hexdigest();assert actual==want,(url,actual,want);return {'url':url,'bytes':len(b),'sha256':actual}
mathHash=hashlib.sha256((root.parent.parent/'cradleos-dapp/dist/casino/slot-fleet-math.json').read_bytes()).hexdigest()
jobs=[(site+'/casino/slot-fleet-math.json',mathHash) for site in [base,immutable]]+[(base+'/'+p,h) for p,h in assets.items()]+[(site+'/'+p.lstrip('/'),h) for site in [base,immutable] for p,h in bundle.items()]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:checks=list(pool.map(verify,jobs))
for site in [base,immutable]:
 html,h=get(site+'/?release='+deployment)
 for p in bundle:assert p in html.decode(),(site,p)
api,h=get(base+'/api/icons?q=LAI&limit=2');j=json.loads(api);assert j and 'text/html' not in h.get('Content-Type','')
result={'deployment':deployment,'source':source,'files':checks,'htmlReferencesExact':True,'iconApiHTTP200':True,'ok':True}
(root/'public-verification.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS',len(checks),'file hashes, both HTML bundle references, public icon API')
