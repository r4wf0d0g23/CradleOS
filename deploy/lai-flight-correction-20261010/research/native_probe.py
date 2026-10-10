import hashlib, math, time
resource_map = json.loads(Path('ship-resource-map.json').read_text())
resource_root = 'Z:' + resource_map['resource_root']
blue.paths.SetSearchPath('res', resource_root + ';' + resource_root + '/dx9;Z:' + resource_map['fallback_resource_root'] + ';Z:' + resource_map['fallback_resource_root'] + '/dx9')
user32 = ctypes.WinDLL('user32')
user32.CreateWindowExW.restype = ctypes.c_void_p
user32.CreateWindowExW.argtypes = [ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
user32.DestroyWindow.argtypes=[ctypes.c_void_p]
window=user32.CreateWindowExW(0,'STATIC','Frontier top-view assets',0x10000000,0,0,1024,1024,None,None,None,None)
assert window
try:
 device=trinity.TriDevice(); device.CreateWindowedDevice(window,1024,1024,0,0)
 factory=trinity.EveSOF(); assert factory.dataMgr.LoadData('res:/dx9/model/spaceobjectfactory/data.black')
 scene=trinity.EveSpaceScene(); scene.backgroundRenderingEnabled=False
 scene.sunDirection=(0.4,-0.8,0.6);scene.sunDiffuseColor=(2.0,1.9,1.8,1.0);scene.ambientColor=(0.4,0.4,0.45,1)
 driver=trinity.EveSpaceSceneRenderDriver();driver.scene=scene;driver.clearColor=(0.015,0.02,0.04,1)
 driver.shadowQuality=0;driver.antiAliasingQuality=0;driver.aoQuality=0;driver.enableUpscaling=False;driver.enableDistortion=False;driver.postProcessingQuality=0
 view=trinity.TriView();projection=trinity.TriProjection();driver.view=view;driver.projection=projection
 target=trinity.Tr2RenderTarget(1024,1024,1,trinity.PIXEL_FORMAT.B8G8R8A8_UNORM)
 node=trinity.Tr2StepExecuteRenderNode();node.node=driver;node.destinationTarget=target;node.clearTargetOnFailure=False
 jobs=trinity.Tr2RenderJobs();job=trinity.TriRenderJob();job.steps.append(node);jobs.recurring.append(job);device.SetRenderJobs(jobs)
 bitmap=trinity.Tr2HostBitmap();bitmap.Create(1024,1024,1,trinity.PIXEL_FORMAT.B8G8R8A8_UNORM)
 result['objects']=[]
 choices=[('lai',95276,34663,'data_lai_01_modular:dataist_ship_01:dataist:layout?strl_data_lai_01_modular_layout_01')]
 for name,tid,gid,dna in choices:
  obj=factory.BuildFromDNA(dna);assert obj is not None;scene.objects.append(obj)
  boosters=getattr(obj,'boosters',None)
  print('SHIP_CLASS',type(obj).__name__,'BOOSTER',str(boosters),flush=True)
  if boosters is not None:
   boosters.alwaysOn=True;boosters.alwaysOnIntensity=1.0;boosters.staticTrailLength=40
   print('BOOSTER_ATTRS',[a for a in dir(boosters) if any(k in a.lower() for k in ['loc','transform','position','glow'])],flush=True)
  locs=getattr(obj,'locators',[])
  print('LOCATORS',[(str(getattr(a,'name','')),str(getattr(a,'transform',''))) for a in locs if 'booster' in str(getattr(a,'name','')).lower()],flush=True)
  center=tuple(obj.boundingSphereCenter);radius=max(float(obj.boundingSphereRadius),1)
  rec={'name':name,'typeID':tid,'graphicID':gid,'dna':dna,'center':center,'radius':radius,'projection':'10 degree perspective top view','captures':[]}
  projection.PerspectiveFov(math.radians(10),1,radius/100,radius*50)
  for index in range(2):
   if index==0:eye=(center[0],center[1]+radius*13,center[2]);up=(0,0,1)
   else:eye=(center[0]+radius*7,center[1]+radius*9,center[2]+radius*6);up=(0,1,0)
   view.SetLookAtPosition(eye,center,up)
   for tick in range(45 if index==0 else 8):blue.os.Pump();device.Render();time.sleep(0.02)
   assert bitmap.CopyFromRenderTarget(target);filename=name+'-'+str(index)+'.png';bitmap.Save(filename)
   rec['captures'].append({'file':filename,'eye':eye,'sha256':hashlib.sha256(Path(filename).read_bytes()).hexdigest()})
   print('captured '+filename,flush=True)
  scene.objects.remove(obj)
  for tick in range(3):blue.os.Pump();device.Render()
  assert bitmap.CopyFromRenderTarget(target);bitmap.Save(name+'-empty.png')
  result['objects'].append(rec)
  Path('sprite-progress.json').write_text(json.dumps(result,indent=2))
 jobs.recurring.remove(job);result['ship_rendered']=True;result['scene_rendered']=True
finally:user32.DestroyWindow(window)
