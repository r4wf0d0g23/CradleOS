import hashlib
import math
import time

config = json.loads(Path('Z:' + '__CONFIG_PATH__').read_text())
asset = json.loads(Path('Z:' + config['asset']).read_text())
resource_map = json.loads(Path('ship-resource-map.json').read_text())
resource_root = 'Z:' + resource_map['resource_root']
blue.paths.SetSearchPath('res', resource_root + ';' + resource_root + '/dx9')
blue.paths.SetSearchPath('custom', 'Z:' + str(Path(config['cmf']).parent))
blue.paths.SetSearchPath('authored', 'Z:' + str(Path(config['asset']).parent))
result.update(ship_rendered=False, scene_rendered=False, custom_mesh=True, skeletal_skinning=False)


def checkpoint(stage):
    result['stage'] = stage
    Path('station-progress.json').write_text(json.dumps(result, indent=2))
    print(stage, flush=True)


user32 = ctypes.WinDLL('user32')
user32.CreateWindowExW.restype = ctypes.c_void_p
user32.CreateWindowExW.argtypes = [ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,
    ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
user32.DestroyWindow.argtypes = [ctypes.c_void_p]
window = user32.CreateWindowExW(0,'STATIC','Authored Casino native Trinity',0x10000000,0,0,960,540,None,None,None,None)
assert window
try:
    device=trinity.TriDevice()
    device.CreateWindowedDevice(window,960,540,0,0)
    scene=blue.resMan.LoadObject('res:/dx9/scene/universe/visible_light_nebula_cube.black')
    assert isinstance(scene,trinity.EveSpaceScene)
    scene.backgroundRenderingEnabled=False
    scene.sunDirection=(-0.3,-0.8,0.5)
    scene.sunDiffuseColor=(4.6,4.2,3.7,1)
    scene.ambientColor=(0.35,0.4,0.5,1)
    ship=trinity.EveShip2()
    ship.name='CRADLE Casino station blockout'
    ship.boundingSphereRadius=40
    ship.boundingSphereCenter=(0,1,0)
    scene.objects.append(ship)
    children=[]
    effects={}
    for material_name,color in asset['materials'].items():
        effect=trinity.Tr2Effect()
        effect.name=material_name
        shader='standardpbrglow' if material_name in ('amber','vein','sign') or material_name.startswith('screen') else 'standardpbr'
        effect.effectFilePath='res:/graphics/effect/managed/space/spaceobject/v5/pbr/standardpbr/'+shader+'.fx'
        effects[material_name]=effect
    for tick in range(150):
        blue.os.Pump()
        device.Render()
        time.sleep(0.01)
    result['materials']={}
    for name,effect in effects.items():
        effect.PopulateParameters()
        result['materials'][name]={'path':effect.actualEffectFilePath,
            'parameters':[{'name':parameter.name,'value':list(parameter.value) if hasattr(parameter.value,'__iter__') else parameter.value} for parameter in effect.parameters],
            'resources':[{'name':resource.name,'path':resource.resourcePath} for resource in effect.resources]}
        color=asset['materials'][name]
        for parameter in effect.parameters:
            if 'DiffuseColor' in parameter.name or parameter.name in ('BaseColor','GlowColor'):
                parameter.value=tuple(color)
        for resource in effect.resources:
            texture={'AlbedoMap':name+'-albedo.png','NormalMap':'normal.png','RoughnessMap':'roughness.png',
                'MetalnessMap':'metalness.png','GlowMap':name+'-albedo.png'}.get(resource.name,'black.png')
            if name in ('calcite','calcite_dark','calcite_edge','crust','tissue','throat','chitin','chitin_edge','chitin_dark','sinew','suture'):
                texture={'RoughnessMap':'growth-roughness.png','MetalnessMap':'growth-metalness.png'}.get(resource.name,texture)
            if name.startswith('chitin') and resource.name=='NormalMap':
                texture='chitin-normal.png'
            texture=asset.get('material_maps',{}).get(name,{}).get(resource.name,texture)
            resource.resourcePath='authored:/'+texture
        effect.RebuildCachedData()
    checkpoint('materials inspected')
    result['resolved_materials']={name:{resource.name:resource.resourcePath for resource in effect.resources} for name,effect in effects.items()}
    for entry in asset['meshes']:
        child=trinity.EveChildMesh()
        child.name=entry['name']
        child.useSRT=True
        child.staticTransform=False
        child.translation=(0,0,0)
        child.scaling=(1,1,1)
        child.rotation=(0,0,0,1)
        child.minScreenSize=0
        mesh=trinity.Tr2Mesh()
        mesh.geometryResPath='custom:/'+Path(config['cmf']).name
        mesh.meshIndex=entry['mesh_index']
        area=trinity.Tr2MeshArea()
        area.name=entry['name']
        area.index=0
        area.count=1
        area.effect=effects[entry['material']]
        mesh.opaqueAreas.append(area)
        child.mesh=mesh
        child.updateAnimation=False
        child.castShadow=asset.get('feral_style')=='cinema'
        ship.effectChildren.append(child)
        children.append((entry,child))
    driver=trinity.EveSpaceSceneRenderDriver()
    driver.scene=scene
    driver.clearColor=(0.018,0.025,0.035,1)
    driver.shadowQuality=0
    driver.antiAliasingQuality=2
    driver.aoQuality=0
    driver.enableUpscaling=False
    driver.enableDistortion=False
    driver.postProcessingQuality=0
    view=trinity.TriView()
    projection=trinity.TriProjection()
    projection.PerspectiveFov(math.radians(65),16/9,0.08,150)
    driver.view=view
    driver.projection=projection
    target=trinity.Tr2RenderTarget(960,540,1,trinity.PIXEL_FORMAT.B8G8R8A8_UNORM)
    node=trinity.Tr2StepExecuteRenderNode()
    node.node=driver
    node.destinationTarget=target
    node.clearTargetOnFailure=False
    jobs=trinity.Tr2RenderJobs()
    job=trinity.TriRenderJob()
    job.steps.append(node)
    jobs.recurring.append(job)
    device.SetRenderJobs(jobs)
    view.SetLookAtPosition((125,74,-130),(0,0,0),(0,1,0))
    for tick in range(200):
        blue.os.Pump()
        scene.UpdateScene(int(tick/24*10000000))
        device.Render()
        time.sleep(0.01)
    result['geometry']={'mesh_count':children[0][1].mesh.geometry.meshCount,
        'mesh_names':[children[0][1].mesh.geometry.GetMeshName(index) for index in range(len(children))]}
    result['captures']=[]
    bitmap=trinity.Tr2HostBitmap()
    bitmap.Create(960,540,1,trinity.PIXEL_FORMAT.B8G8R8A8_UNORM)
    import os,struct,uuid
    ipc=Path('Z:' + config['ipc'])
    ipc.mkdir(exist_ok=True)
    (ipc/'ready.json').write_text(json.dumps({'ready':True,'width':960,'height':540,'pid':os.getpid()}))
    result['stream_frames']=0
    result['camera_samples']=[]
    started=time.monotonic();seq=0
    while time.monotonic()-started<config['lifetime'] and not (ipc/'shutdown').exists():
        loop_started=time.monotonic()
        (ipc/'heartbeat.next').write_text(json.dumps({'at':int(time.time()*1000)}))
        os.replace(ipc/'heartbeat.next',ipc/'heartbeat.json')
        try:commands=json.loads((ipc/'cameras.json').read_text())
        except (OSError,ValueError):time.sleep(.05);continue
        for slot in commands.get('slots',[])[:2]:
            index=slot['slot'];assert index in (0,1)
            eye=slot['eye'];focus=slot['focus'];assert len(eye)==len(focus)==3
            assert all(isinstance(n,(int,float)) and math.isfinite(n) and abs(n)<100 for n in eye+focus)
            identity=uuid.UUID(slot['id']).bytes
            view.SetLookAtPosition(tuple(eye),tuple(focus),(0,1,0))
            blue.os.Pump();scene.UpdateScene(int((time.monotonic()-started)*10000000));device.Render()
            assert bitmap.CopyFromRenderTarget(target)
            raw,width,height,pitch=bitmap.GetRawData()
            assert width==960 and height==540 and pitch==3840
            seq+=1
            data=struct.pack('<QQQ',seq,int(time.time()*1000),slot.get('sequence',0))+identity+bytes(raw)
            tmp=ipc/('frame-%d.next'%index);tmp.write_bytes(data);os.replace(tmp,ipc/('frame-%d.raw'%index))
            result['stream_frames']+=1
            if seq%120==0:result['camera_samples'].append({'slot':index,'eye':eye,'seq':seq})
        if seq and seq%60==0:(ipc/'native-stats.json').write_text(json.dumps({'frames':seq,'elapsed':time.monotonic()-started}))
        time.sleep(max(0,.05-(time.monotonic()-loop_started)))
    result.update(ship_rendered=True,scene_rendered=True,stream_finished=True)
    (ipc/'stopped.json').write_text(json.dumps({'frames':seq,'elapsed':time.monotonic()-started}))
    checkpoint('native stream capture finished')
finally:
    user32.DestroyWindow(window)
