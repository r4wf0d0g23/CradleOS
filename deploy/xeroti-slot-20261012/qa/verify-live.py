import pathlib,hashlib,json,re,urllib.request,time,sys
root=pathlib.Path(__file__).resolve().parents[3];dist=root/'cradleos-dapp/dist';out=pathlib.Path(__file__).resolve().parent.parent/'live-build.json'
expected=re.findall(r'(?:src|href)="(/assets/index-[^"]+)"',(dist/'index.html').read_text())
paths=expected+['/assets/casino/xeroti/xeroti-hero.webp','/assets/casino/xeroti/xeroti-symbol.png','/casino/xeroti-slot-math.json']
for attempt in range(12):
 try:
  req=urllib.request.Request('https://cradleos.io/?xeroti-verify='+str(int(time.time())),headers={'Cache-Control':'no-cache'})
  html=urllib.request.urlopen(req,timeout=25).read().decode()
  assert all(p in html for p in expected),'previous HTML bundle still served'
  verified=[]
  for p in paths:
   data=urllib.request.urlopen('https://cradleos.io'+p,timeout=25).read();local=(dist/p.lstrip('/')).read_bytes();assert data==local,p
   verified.append({'path':p,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
  out.write_text(json.dumps({'origin':'https://cradleos.io','verified':verified,'status':'exact-match'},indent=2)+'\n');print(json.dumps(verified,indent=2),flush=True);break
 except Exception as e:
  print('Attempt',attempt+1,type(e).__name__,str(e),flush=True)
  if attempt==11:raise
  time.sleep(10)
