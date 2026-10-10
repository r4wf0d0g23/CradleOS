from pathlib import Path
from PIL import Image,ImageEnhance
import numpy as np,json,hashlib,ast,math
repo=Path(__file__).resolve().parents[3];ws=repo.parents[1];src=ws/'artifacts/frontier-drift-campaign-20261005/research/lai-sprite/native-proof';dst=repo/'cradleos-dapp/public/casino/lai-jump';dst.mkdir(exist_ok=True)
image=src/'lai-0.png';assert hashlib.sha256(image.read_bytes()).hexdigest()=='ae492664e7ce5bfd49f0c198cc7ab580c1aa1a2e28f19b4f8e9a660ed2f8fbb3'
im=Image.open(image).convert('RGB');empty=Image.open(src/'lai-empty.png').convert('RGB');mask=np.max(np.abs(np.asarray(im,dtype=np.int16)-np.asarray(empty,dtype=np.int16)),axis=2)>3
# Connected-component matte: only solid hull, no detached native navigation flares.
seen=np.zeros(mask.shape,bool);alpha=np.zeros(mask.shape,np.uint8)
for yy,xx in zip(*np.nonzero(mask)):
 if seen[yy,xx]:continue
 stack=[(int(yy),int(xx))];seen[yy,xx]=True;pts=[]
 while stack:
  y,x=stack.pop();pts.append((y,x))
  for ny,nx in ((y-1,x),(y+1,x),(y,x-1),(y,x+1)):
   if 0<=ny<1024 and 0<=nx<1024 and mask[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;stack.append((ny,nx))
 if len(pts)>=120:
  for y,x in pts:alpha[y,x]=255
matte=Image.fromarray(alpha);box=matte.getbbox();rgba=ImageEnhance.Brightness(im).enhance(1.3).convert('RGBA');rgba.putalpha(matte)
# Native view up=+Z, and booster direction is +Z with exhaust offset -direction.
# Thus bow is image-up. CLOCKWISE (not the prior derivative's CCW) maps bow right.
rgba=rgba.crop(box).transpose(Image.Transpose.ROTATE_270);rgba.thumbnail((512,768),Image.Resampling.LANCZOS);rgba.save(dst/'lai-top.webp',quality=96,method=6)
run=ws/'.tmp/lai-flight-correction-native/ae4355e5c1f6450380fb8bb34b8c789a';log=(run/'stdout.log').read_text();locs=ast.literal_eval(next(l[9:] for l in log.splitlines() if l.startswith('LOCATORS ')));locs=[{'name':n,'matrix':ast.literal_eval(m)} for n,m in locs if n.startswith('locator_booster_')]
for l in locs:assert l['matrix'][2][2]>0 and abs(l['matrix'][2][0])<.0001
# Project dominant engines through the exact camera, then crop and CW rotate.
center=[-.01600000076,.5156999826,1.200799942];dist=84.63259887695*13;focal=512/math.tan(math.radians(5));w,h=box[2]-box[0],box[3]-box[1];renderH=246;renderW=renderH*h/w;scale=renderH/w
eng=[]
for sign in [-1,0,1]:
 group=[l['matrix'][3] for l in locs if l['matrix'][2][2]>5 and (l['matrix'][3][0]<-10 if sign==-1 else l['matrix'][3][0]>10 if sign==1 else abs(l['matrix'][3][0])<10)]
 xyz=np.mean(np.array(group),axis=0);den=dist+center[1]-xyz[1];px=512-(xyz[0]-center[0])*focal/den;py=512-(xyz[2]-center[2])*focal/den;eng.append({'x':round((box[3]-py)*scale-renderW/2,4),'y':round((px-box[0])*scale-renderH/2,4)})
# Voronoi hull fragments with actual visible alpha mass and centroid; uneven plates, not a checkerboard.
A=np.array(rgba.getchannel('A'));H,W=A.shape;yy,xx=np.indices((H,W));X=(xx+.5)*renderW/W-renderW/2;Y=(yy+.5)*renderH/H-renderH/2
seeds=[(-7,-91),(-7,91),(-28,-40),(-28,40),(24,-42),(24,42),(-32,0),(26,0),(2,0)]
nearest=np.argmin(np.stack([(X-x)**2+(Y-y)**2 for x,y in seeds]),axis=0);frags=[]
for i,(sx,sy) in enumerate(seeds):
 polygon=[(-renderW/2,-123),(renderW/2,-123),(renderW/2,123),(-renderW/2,123)]
 for j,(ox,oy) in enumerate(seeds):
  if i==j:continue
  a,b=2*(ox-sx),2*(oy-sy);c=ox*ox+oy*oy-sx*sx-sy*sy;out=[]
  for k,P in enumerate(polygon):
   Q=polygon[(k+1)%len(polygon)];fp=a*P[0]+b*P[1]-c;fq=a*Q[0]+b*Q[1]-c
   if fp<=0:out.append(P)
   if (fp<=0)!=(fq<=0):t=fp/(fp-fq);out.append((P[0]+t*(Q[0]-P[0]),P[1]+t*(Q[1]-P[1])))
  polygon=out
 weights=A*(nearest==i);mass=float(weights.sum());cx=float((weights*X).sum()/mass);cy=float((weights*Y).sum()/mass)
 frags.append({'points':' '.join(f'{x:.4f},{y:.4f}' for x,y in polygon),'cx':round(cx,4),'cy':round(cy,4),'mass':mass,'inertia':float((weights*((X-cx)**2+(Y-cy)**2)).sum()),'spin':(-1 if i%2 else 1)*(14+i*4)})
geometry={'width':renderW,'height':246,'engines':eng,'fragments':frags};(repo/'cradleos-dapp/src/lib/casinoLaiHull.json').write_text(json.dumps(geometry,indent=2)+'\n')
receipt={'typeId':95276,'graphicId':34663,'dna':'data_lai_01_modular:dataist_ship_01:dataist:layout?strl_data_lai_01_modular_layout_01','render':'Native Trinity build3573151 booster-off top view, approximate materials','sourceSha256':hashlib.sha256(image.read_bytes()).hexdigest(),'sourceBox':box,'rotation':'90 degrees clockwise; +Z bow to +screenX','boosterLocatorCount':len(locs),'boosterDirection':'+Z','exhaustDirection':'-Z (native CreateBoosterFlares pos - direction)','enginesScreen':eng,'fragmentMass':'alpha-pixel proxy, not physical component masses','output':'/casino/lai-jump/lai-top.webp','sha256':hashlib.sha256((dst/'lai-top.webp').read_bytes()).hexdigest(),'bytes':(dst/'lai-top.webp').stat().st_size,'limits':'Authored physically coherent 2D presentation; no runtime3D or literal warp physics claim'}
(Path(__file__).parent/'art-source.json').write_text(json.dumps(receipt,indent=2)+'\n');(Path(__file__).parent/'booster-locators.json').write_text(json.dumps(locs,indent=2)+'\n');print(json.dumps(receipt,indent=2))
