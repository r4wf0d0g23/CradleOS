import subprocess,pathlib,hashlib,json,re,datetime,os
root=pathlib.Path('cradleos-dapp/dist');base='https://cradleos.io/'
def get(path):return subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','25',base+path.lstrip('/')])
source=os.environ['QA_SOURCE'];html=get('?release=plinko-rig-'+source).decode();local=(root/'index.html').read_text();paths=re.findall(r'(?:src|href)="(/assets/[^\"]+\.(?:js|css))"',local)
assert paths and all(p in html for p in paths),'HTML mismatch'
assets=json.loads(pathlib.Path('deploy/plinko-frontier-rig-20261010/assets.json').read_text());paths += ['/data/icons-cycle7-3573151/manifest.json'] + ['/data/icons-cycle7-3573151/'+a['asset'] for a in assets.values()];report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':base,'source':subprocess.check_output(['git','rev-parse',source]).decode().strip(),'files':[]}
for p in paths:
 data=get(p);assert data==(root/p.lstrip('/')).read_bytes(),p
 report['files'].append({'path':p,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'exactMatch':True})
pathlib.Path('deploy/plinko-frontier-rig-20261010/live-build.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
