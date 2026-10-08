"""Read-only operational review: execute redirected supervisor with fake children.
No native render, service or shared cleanup state is touched.
"""
import hashlib,json,pathlib,signal,sys,tempfile,types
ROOT=pathlib.Path(__file__).resolve().parents[3]
SOURCE=ROOT/'services/casino-station/native/supervise.py'
source=SOURCE.read_text()
results=[]
cases=[
 ('abrupt_no_receipt',None,'missing',True),
 ('abrupt_bad_json',None,'bad_json',True),
 ('abrupt_array',None,[],True),
 ('abrupt_null',None,None,True),
 ('abrupt_false',None,{'wine_cleanup':False},True),
 ('stopping_unverified',None,'stopping_missing',True),
 ('stopping_verified',None,{'wine_cleanup':True},False),
 ('preflight_no_job',None,'nojob',False),
 ('startup_unverified','missing','nojob',True),
 ('startup_array',[],'nojob',True),
 ('startup_null',None,'startup_null',True),
 ('startup_bad_json','bad_json','nojob',True),
 ('startup_verified',{'wine_cleanup':True},'nojob',False),
 ('startup_missing_job','nojob','nojob',False),
 ('sentinel_bad_json','sentinel_bad_json','nojob',True),
 ('sentinel_bad_path','sentinel_bad_path','nojob',True),
 ('existing_shared_gate','shared_gate','nojob',True),
]
original_subprocess=sys.modules.get('subprocess')
old_signals={s:signal.getsignal(s) for s in (signal.SIGTERM,signal.SIGINT)}
def write_receipt(job,value):
 (job/'native'/'owned').mkdir(parents=True)
 if value=='missing':return
 (job/'native'/'owned'/'receipt.json').write_text('{' if value=='bad_json' else json.dumps(value))
try:
 for name,prior,payload,expected_gate in cases:
  with tempfile.TemporaryDirectory(prefix='station-gate-review-') as td:
   state=pathlib.Path(td)/'state';state.mkdir();gate=pathlib.Path(td)/'cleanup-required';active=state/'active-run.json'
   if prior is not None or name=='startup_null':
    previous=state/'job-previous'
    if prior=='shared_gate':gate.write_text('preserve-existing-gate')
    elif prior=='sentinel_bad_json':active.write_text('{')
    elif prior=='sentinel_bad_path':active.write_text(json.dumps({'job':str(pathlib.Path(td)/'outside')}))
    else:
     active.write_text(json.dumps({'job':str(previous)}))
     if prior!='nojob':write_receipt(previous,prior)
   code=source.replace("STATE=Path.home()/'.local/state/cradle-station'",'STATE=Path('+repr(str(state))+')').replace("Path('/home/rawdata/frontier-client/compat/.production-cleanup-required')",'Path('+repr(str(gate))+')')
   env={'__file__':str(SOURCE),'__name__':'__main__'};spawns=[]
   class Child:
    returncode=-9
    def poll(self):return self.returncode
   def popen(argv):
    job=pathlib.Path(argv[-1]);assert json.loads(active.read_text())['job']==str(job)
    spawns.append(str(job));env['stop']=True
    if payload!='nojob':write_receipt(job,'missing' if payload=='stopping_missing' else payload)
    return Child()
   sys.modules['subprocess']=types.SimpleNamespace(Popen=popen)
   error=None
   try:exec(compile(code,str(SOURCE),'exec'),env)
   except SystemExit as e:error={'type':'SystemExit','message':str(e)}
   except Exception as e:error={'type':type(e).__name__,'message':str(e)}
   blocked_startup=prior is not None and expected_gate or name=='startup_null'
   passed=gate.exists()==expected_gate and (not blocked_startup or len(spawns)==0) and (error is None or error['type']=='SystemExit')
   if expected_gate:passed=passed and (active.exists() or prior=='shared_gate')
   else:passed=passed and not active.exists() and len(spawns)==1
   if prior=='shared_gate':passed=passed and gate.read_text()=='preserve-existing-gate'
   results.append({'case':name,'pass':passed,'spawns':len(spawns),'gate':gate.exists(),'active_retained':active.exists(),'exit':error})
finally:
 if original_subprocess is None:sys.modules.pop('subprocess',None)
 else:sys.modules['subprocess']=original_subprocess
 for sig,handler in old_signals.items():signal.signal(sig,handler)
report={'source_sha256':hashlib.sha256(source.encode()).hexdigest(),'scope':'isolated supervisor execution; mocked Popen; redirected STATE and global cleanup path; no native or service processes','pass':all(r['pass'] for r in results),'checks':results}
OUT=pathlib.Path(__file__).with_name('supervisor-gates.json');OUT.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2));raise SystemExit(0 if report['pass'] else 1)
