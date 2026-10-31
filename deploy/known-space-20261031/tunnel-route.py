#!/usr/bin/env python3
"""Add only the reviewed known-space read endpoint; preserve existing ingress."""
import json,os,pathlib,sys,urllib.request
url='https://api.cloudflare.com/client/v4/accounts/c9931cf81700e54630061f2fb036959b/cfd_tunnel/0e7f6a56-9bad-4990-9ccd-0e273bc7e06a/configurations'
def call(method='GET',body=None):
    req=urllib.request.Request(url,method=method,headers={'Authorization':'Bearer '+os.environ['CLOUDFLARE_API_TOKEN'],'Content-Type':'application/json'},data=json.dumps(body).encode() if body is not None else None)
    result=json.load(urllib.request.urlopen(req,timeout=30));assert result['success'];return result['result']
prior=json.loads((pathlib.Path.home()/'.local/share/cradleos-known-space/tunnel-before.json').read_text())
current=call();assert current['config']==prior['config'], 'Tunnel changed since preview; re-review required'
config=json.loads(json.dumps(current['config']));entry={'hostname':'keeper.reapers.shop','path':'^/known-space$','service':'http://localhost:8045'}
fallback=next(i for i,x in enumerate(config['ingress']) if x.get('hostname')=='keeper.reapers.shop' and not x.get('path'))
config['ingress'].insert(fallback,entry)
if '--apply' not in sys.argv:print(json.dumps({'dryRun':True,'added':entry,'preservedRules':len(prior['config']['ingress'])}));sys.exit(0)
response=call('PUT',{'config':config});readback=call();assert readback['config']==config
receipt={'at':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),'version':readback['version'],'priorVersion':prior['version'],'added':entry,'otherConfigurationUnchanged':True}
path=pathlib.Path(__file__).parent/'tunnel-publication.json';path.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
