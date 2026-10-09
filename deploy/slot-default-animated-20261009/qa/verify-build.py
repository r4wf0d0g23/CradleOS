import hashlib,json,re,subprocess
from pathlib import Path
repo=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent.parent
def get(url):
 return subprocess.check_output(['curl','--fail','--silent','--show-error','--max-time','45',url])
html=get('https://cradleos.io/')
paths=re.findall(r'(?:src|href)="(/assets/[^" ]+\.(?:js|css))"',html.decode())
assert len(paths)==2,paths
files=[]
for path in paths:
 live=get('https://cradleos.io'+path)
 local=(repo/'cradleos-dapp/dist'/path.lstrip('/')).read_bytes()
 row={'path':path,'sha256':hashlib.sha256(live).hexdigest(),'distSha256':hashlib.sha256(local).hexdigest(),'exactMatch':live==local}
 files.append(row)
assert all(x['exactMatch'] for x in files)
report={'source':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),'origin':'https://cradleos.io/','files':files}
(out/'live-build.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
