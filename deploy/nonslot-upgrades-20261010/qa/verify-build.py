import subprocess, pathlib, hashlib, json, re, datetime, os
root=pathlib.Path('cradleos-dapp/dist'); base='https://cradleos.io/'
def get(path): return subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','25',base+path.lstrip('/')])
source=os.environ.get('QA_SOURCE','e8459b4'); tag=os.environ.get('QA_TAG','live'); html=get('?release=nonslot-'+source).decode(); local=(root/'index.html').read_text()
paths=re.findall(r'(?:src|href)="(/assets/[^\"]+\.(?:js|css))"',local)
assert paths and all(p in html for p in paths),'HTML does not reference reviewed assets'
manifest=next(root.glob('data/icons-cycle7-*/manifest.json')); paths.append('/'+str(manifest.relative_to(root)))
m=json.loads(manifest.read_text())
paths.extend('/'+str(manifest.parent.relative_to(root))+'/'+m['types'][str(t)]['asset'] for t in [82425,87848,81611,84955])
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':base,'source':subprocess.check_output(['git','rev-parse',source]).decode().strip(),'files':[]}
for p in paths:
 data=get(p); assert data==(root/p.lstrip('/')).read_bytes(),p
 report['files'].append({'path':p,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'exactMatch':True})
pathlib.Path('deploy/nonslot-upgrades-20261010/'+tag+'-build.json').write_text(json.dumps(report,indent=2)+'\n'); print(json.dumps(report,indent=2))
