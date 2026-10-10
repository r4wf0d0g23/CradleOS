"""Derive a lightweight scenic plate from a verified native Frontier thumbnail."""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageEnhance,ImageDraw,ImageFilter
root=Path(__file__).resolve().parents[2]
source=Path('/home/rawdata/frontier-client/launcher/fex-linux/wineprefix/drive_c/CCP/EVE Frontier/ResFiles/af/af1c411d2d1250ef_37862f004e91a554cd3995d10e22e259')
b=source.read_bytes();assert len(b)==19059 and hashlib.md5(b).hexdigest()=='37862f004e91a554cd3995d10e22e259'
out=root/'cradleos-dapp/public/casino/craps-orbit/mini-gate.webp'
im=Image.open(source).convert('RGB')
# Remove only near-black background connected to the outer border. Interior hull
# shadows remain opaque; the supplied native silhouette is not redrawn.
background=Image.new('L',im.size);background.putdata([255 if max(rgb)<=12 else 0 for rgb in im.getdata()]);ImageDraw.floodfill(background,(0,0),128,thresh=0)
alpha=background.point(lambda p:0 if p==128 else 255).filter(ImageFilter.GaussianBlur(.35))
im=ImageEnhance.Brightness(im).enhance(1.7).convert('RGBA');im.putalpha(alpha);im.save(out,quality=93,method=6)
(root/'deploy/craps-orbital-deck-20261010/art-source.json').write_text(json.dumps({'build':'3573151','typeId':88086,'name':'Mini Gate','graphicId':28064,'source':'res:/dx9/model/spaceobjectfactory/icons/dep_stargate_s_01v01/28064_512_no_background.jpg','sourceMd5':hashlib.md5(b).hexdigest(),'sourceSha256':hashlib.sha256(b).hexdigest(),'derivation':'Border-connected near-black background removed (maxRGB<=12), 0.35px alpha edge, brightness1.7 and WebP encode. Native hull silhouette and geometry unchanged; no generated replacement.','output':str(out.relative_to(root)),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'reusedNativeArt':'casino/lai-jump/lai-hull.webp; provenance deploy/lai-jump-20261010/art-source.json','originalArt':'CSS starfield, planetary limb and hull/table assembly are original UI; existing floor_plate.jpg reused as a surface texture, not claimed as verified native art.'},indent=2)+'\n')
