import subprocess,pathlib,hashlib,json,re,datetime,os
root=pathlib.Path('cradleos-dapp/dist');base='https://cradleos.io/'
def get(path):return subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','25',base+path.lstrip('/')])
source=os.environ['QA_SOURCE'];html=get('?release=frontier-six-'+source).decode();local=(root/'index.html').read_text();paths=re.findall(r'(?:src|href)="(/assets/[^\"]+\.(?:js|css))"',local)
assert len(paths)==2 and all(p in html for p in paths),'HTML mismatch'
pack='data/icons-cycle7-3573151/';manifest=json.loads((root/pack/'manifest.json').read_text())
paths += ['/casino/craps-orbit/mini-gate.webp','/casino/lai-jump/lai-top.webp','/'+pack+'manifest.json']
paths += ['/'+pack+manifest['types'][str(n)]['asset'] for n in [82425,87848,81611,84955,78423,72244,84180]]
assert len(paths)==len(set(paths))==12
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':base,'source':subprocess.check_output(['git','rev-parse',source]).decode().strip(),'files':[]}
for p in paths:
 data=get(p);assert data==(root/p.lstrip('/')).read_bytes(),p
 report['files'].append({'path':p,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'exactMatch':True})
pathlib.Path('deploy/frontier-six-games-20261010/live-build.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
