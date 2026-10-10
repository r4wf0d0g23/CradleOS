import subprocess,pathlib,hashlib,json,re,datetime,os
root=pathlib.Path('cradleos-dapp/dist');base='https://cradleos.io/'
def get(path):return subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','25',base+path.lstrip('/')])
source=os.environ['QA_SOURCE'];html=get('?release=command-cards-'+source).decode();local=(root/'index.html').read_text();paths=re.findall(r'(?:src|href)="(/assets/[^\"]+\.(?:js|css))"',local)
assert len(paths)==2 and all(p in html for p in paths),'HTML mismatch'
paths += ['/casino/lai-jump/lai-top.webp', '/data/icons-cycle7-3573151/manifest.json']
paths += ['/data/icons-cycle7-3573151/assets/'+x+'.png' for x in ['fb8f910216c44311827be0f0f7261309419be1eb96ab4150187d6d5bde5b84ca','d1f327dd6415de93cfa85355413a7ab04712edd6eb11713b4e7974d7ac30d274','35f04d82da92358be531d44d585f55af6e7d661c35b59c96444c0e136da4a645','f87c0dbaf65f720bb231fb1229fe10682c8d282adde59f1fa765aea0f6896862']]
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':base,'source':subprocess.check_output(['git','rev-parse',source]).decode().strip(),'files':[]}
for p in paths:
 data=get(p);assert data==(root/p.lstrip('/')).read_bytes(),p
 report['files'].append({'path':p,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'exactMatch':True})
pathlib.Path('deploy/command-card-deck-20261010/live-build.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
