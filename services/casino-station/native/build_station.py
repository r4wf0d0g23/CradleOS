"""Authored station blockout. Native Carbon Mesh output, no Blender or browser renderer."""
from pathlib import Path
import importlib.util,json,hashlib,struct,os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
WORKSPACE=Path('/home/rawdata/.openclaw-captain/workspace')
spec=importlib.util.spec_from_file_location('geometry',WORKSPACE/'tools/frontier-animation/native-carbon/solstice/build_asset.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
g=mod.Geometry()
colors={'hull':[.20,.22,.23,1],'armor':[.30,.32,.33,1],'recess':[.025,.03,.04,1], 'amber':[.95,.23,.035,1], 'vein':[.30,.66,.64,1], 'sign':[.85,.81,.71,1]}
meshes={m:g.mesh(m,m) for m in colors}
def box(m,p,s):g.box(meshes[m],p,s,0.08)
# Panelled concourse and ceiling ribs. Deliberately human-scale authored units.
for x in range(-20,20,4):
 for z in range(-24,24,4):box('hull',[x+2,-.15,z+2],[3.95,.3,3.95])
for side in (-1,1):
 box('hull',[side*20,3,0],[.4,6,48])
 box('amber',[side*19.76,.25,0],[.05,.08,46])
 for z in range(-22,24,6):
  box('armor',[side*19.5,3,z],[.5,6,.45]);box('vein',[side*19.21,2.7,z],[.035,2,.075])
for z in (-24,24):box('hull',[0,3,z],[40,6,.4])
for z in range(-22,24,6):
 box('armor',[0,6,z],[40,.35,.45]);box('amber',[0,5.81,z],[38,.04,.09])
# Ceiling panels are omitted to let the first blockout lighting establish massing.
terminals=[]
def terminal(x,z,zone,n):
 terminals.append({'x':x,'z':z,'zone':zone,'ordinal':n})
 box('armor',[x,.7,z],[1.8,1.4,1]);box('recess',[x,1.85,z-.05],[1.7,1.05,.45])
 box('amber',[x,2.42,z-.05],[1.82,.08,.5]);box('vein',[x,1.85,z+.19],[1.48,.85,.025])
 box('recess',[x,1.03,z+.6],[1.8,.13,.6]);box('sign',[x,1.11,z+.6],[.35,.035,.16])
for i in range(9):terminal(-16+(i%3)*4,-16+(i//3)*6,'slot-gallery',i)
for i in range(8):terminal(8+(i%3)*4,-16+(i//3)*6,'card-lounge',i)
for i in range(11):terminal(-15+(i%6)*6,6+(i//6)*6,'probability-deck',i)
for i in range(6):terminal(-3+(i%2)*6,-16+(i//2)*6,'salvage-arcade',i)
# Runway lighting; central airlock, observation frame.
for z in range(-21,22,3):
 for x in (-.8,.8):box('amber',[x,.02,z],[.08,.03,1.4])
box('recess',[0,2.2,23.7],[5,4.4,.15])
box('amber',[-2.55,2.2,23.55],[.09,4.4,.05]);box('amber',[2.55,2.2,23.55],[.09,4.4,.05])
box('sign',[0,4.85,-23.65],[12,.12,.1])
out=Path(os.environ.get('STATION_ASSET_OUTPUT',str(ROOT/'assets')));out.mkdir(exist_ok=False)
# Native textured terminal displays from the reviewed browser game's own art pack.
catalog=json.loads((ROOT.parent/'catalog.json').read_text())
public=ROOT.parents[2]/'cradleos-dapp/public'
slot_art=json.loads((ROOT.parent/'slot-art.json').read_text())
icon_root=public/'data/icons-cycle7-3573151'
icon_manifest=json.loads((icon_root/'manifest.json').read_text())
font='/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'
def screen(name,x,y,z,w,h,texture):
 colors[name]=[1,1,1,1]
 m=g.mesh(name,name)
 points=[(x-w/2,y+h/2,z),(x+w/2,y+h/2,z),(x-w/2,y-h/2,z),(x+w/2,y-h/2,z)]
 for v,uv in zip(points,[(0,0),(1,0),(0,1),(1,1)]):m['vertices'].append([*v,0,0,1,1,0,0,0,-1,0,*uv])
 m['indices'] += [0,2,1,1,2,3]
 texture.save(out/(name+'-albedo.png'))
for index,(t,game) in enumerate(zip(terminals,catalog)):
 im=Image.new('RGB',(512,320),(8,12,15));d=ImageDraw.Draw(im)
 card=public/'casino/cards'/(game['key']+'.webp')
 if card.exists():
  image=Image.open(card).convert('RGB');image.thumbnail((490,240));im.paste(image,((512-image.width)//2,12))
 elif game['key'] in slot_art:
  identity=slot_art[game['key']]
  for col,symbol in enumerate(identity['symbols'][:3]):
   ref=icon_manifest['library'][symbol['library']]
   icon=Image.open(icon_root/ref['asset']).convert('RGBA');icon.thumbnail((144,144))
   im.paste(icon,(32+col*156,57),icon)
  d.line((24,28,488,28),fill=identity['accent'],width=8)
 else:
  d.ellipse((145,30,365,220),outline=(255,85,28),width=9);d.text((255,110),'CRADLE',anchor='mm',font=ImageFont.truetype(font,30),fill=(220,230,217))
 d.rectangle((0,253,512,320),fill=(9,13,16))
 label=game['name'].upper();size=28
 while ImageFont.truetype(font,size).getlength(label)>485:size-=1
 d.text((256,285),label,anchor='mm',font=ImageFont.truetype(font,size),fill=(248,233,206))
 screen('screen'+str(index),t['x'],1.85,t['z']+.22,1.48,.85,im)
 if game['key'] in slot_art:
  accent=slot_art[game['key']]['accent'];colors['screen'+str(index)]=[int(accent[i:i+2],16)/255 for i in (1,3,5)]+[1]
 else:colors['screen'+str(index)]=[.68,.9,.84,1]
 t['key']=game['key']
im=Image.new('RGB',(2048,512),(12,15,18));d=ImageDraw.Draw(im)
d.line((60,70,1988,70),fill=(255,71,0),width=12)
d.text((1024,225),'C R A D L E   /   C A S I N O',font=ImageFont.truetype(font,115),anchor='mm',fill=(240,231,209))
d.text((1024,405),'RECLAIMED STATION  •  ENTER THE FRONTIER',font=ImageFont.truetype(font,37),anchor='mm',fill=(130,180,171))
screen('screen-sign',0,4.35,-23.4,15,3.75,im)
entries=[]
with (out/'station.meshbin').open('wb') as f:
 f.write(struct.pack('<II',0x534F4C31,len(g.meshes)))
 for i,m in enumerate(g.meshes.values()):
  name=m['name'].encode();f.write(struct.pack('<I',len(name))+name);f.write(struct.pack('<II',len(m['vertices']),len(m['indices'])))
  f.write(np.asarray(m['vertices'],dtype='<f4').tobytes());f.write(np.asarray(m['indices'],dtype='<u4').tobytes())
  entries.append({k:v for k,v in m.items() if k not in ('vertices','indices')}|{'mesh_index':i,'vertices':len(m['vertices']),'triangles':len(m['indices'])//3})
for name,c in [(n,c) for n,c in colors.items() if not n.startswith('screen')]:Image.new('RGB',(32,32),tuple(round(v*255) for v in c[:3])).save(out/(name+'-albedo.png'))
for name,c in {'normal':(128,128,255),'roughness':(180,180,180),'metalness':(100,100,100),'black':(0,0,0)}.items():Image.new('RGB',(16,16),c).save(out/(name+'.png'))
asset={'schema':'cradle.casino.native-station.v1','asset_id':'casino-station-pilot-02','status':'native-streaming-pilot','skeletal_skinning':False,'materials':colors,'meshes':entries,'terminalCount':len(terminals),'terminals':terminals,'units':'authored human-scale scene units','renderer':'native Carbon Trinity DX11'}
(out/'asset.json').write_text(json.dumps(asset,indent=2)+'\n')
print(json.dumps({'asset':str(out),'triangles':sum(e['triangles'] for e in entries),'terminals':len(terminals)}))
