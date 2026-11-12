"""Publish derived build3693609 reference JSON only; never update legacy planner/icons."""
import argparse,collections,csv,hashlib,importlib.util,json,re
from pathlib import Path
BUILD='3693609'
WORLD='0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92'
HEAD={'schemaVersion':2,'cycle':7,'server':'Stillness','world':WORLD,'build':BUILD}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
def main():
 a=argparse.ArgumentParser();a.add_argument('--evidence',type=Path,required=True);a.add_argument('--out',type=Path,required=True);a.add_argument('--client-root',type=Path,required=True);args=a.parse_args()
 e=args.evidence;n=e/'native-3693609';out=args.out;out.mkdir(parents=True,exist_ok=True)
 proof=load(n/'inputs.json');summary=load(n/'decode-summary.json');run=load(n/'decode-run.json')
 assert proof['build']==BUILD and run['exit']==0 and run['cleaned'] and run['inputsUnchanged']
 assert sha(n/'inputs.json')==run['inputsSha256']==summary['inputsSha256']
 assert sha(n/'decode_all.py')==summary['decoderSha256']==run['scriptSha256']
 for row in proof['files']:assert sha(n/row['file'])==row['sha256']
 tables={}
 for name,meta in summary['tables'].items():
  p=n/'decoded'/(name+'.json');assert sha(p)==meta['sha256'];tables[name]=load(p);assert len(tables[name])==meta['records']
 spec=importlib.util.spec_from_file_location('safe',Path(__file__).resolve().parents[1]/'cycle7/extract_game_data.py');safe=importlib.util.module_from_spec(spec);spec.loader.exec_module(safe)
 strings,total,numeric=safe.build_strings(safe.loads((n/'data/localization_fsd_en-us.pickle').read_bytes()))
 api=load(e/'types.raw');apiproof=load(e/'types.proof.json');assert sha(e/'types.raw')==apiproof['sha256'];api={str(x['id']):x for x in safe.official_types(api)}
 t=tables['types'];groups=tables['groups'];recipes=tables['recipe'];properties=tables['property'];traits=tables['trait'];fac=tables['recipefacilities']
 def text(id):return strings.get(str(id))
 def name(id):return text(t.get(str(id),{}).get('typeNameID')) or f'Unnamed type #{id}'
 def clean(s):return re.sub(r'<[^>]*>','',re.sub(r'<br\s*/?>','\n',s or '',flags=re.I))
 categories={str(v['categoryId']):v['categoryName'] for v in api.values()}
 reference=set(api)|set(tables['neotypeproperty'])|set(tables['creation_templates'])|{str(v['id']) for v in load(e/'added-types.json')}
 for table,field in [('recipeinput','inputs'),('recipeoutput','outputs')]:
  for row in tables[table].values():reference.update(str(v['typeID']) for v in row[field] if 'typeID' in v)
 reference.update(fac)
 for row in tables['creation_templates'].values():
  reference.update(str(x['type_id']) for x in row['interior_modules']);reference.update(str(x['type_id']) for x in row['parts'].values())
  reference.update(str(h['exterior_type_id']) for x in row['interior_modules'] for h in x.get('hardpoints',[]) if 'exterior_type_id' in h)
 items=[]
 for id in sorted(set(t)|set(api),key=int):
  v=t.get(id);av=api.get(id);group=groups.get(str(v.get('groupID'))) if v else None
  items.append({'id':int(id),'name':name(id) if v else av['name'],'description':clean(text(v.get('descriptionID'))) if v else av['description'],'group':text(group.get('groupNameID')) if group else av.get('groupName') if av else None,'category':categories.get(str(group.get('categoryID')),f"Category {group['categoryID']}") if group else av.get('categoryName') if av else None,'mass':v.get('mass') if v else None,'volume':v.get('volume') if v else None,'quantityKind':v.get('quantityKind') if v else None,'published':v.get('published') if v else None,'reference':id in reference,'clientRecord':v is not None,'api':{k:av[k] for k in ['name','mass','volume','categoryName','groupName']} if av else None})
 units={k:{'name':v['name'],'label':text(v.get('displayNameID')),'description':text(v.get('descriptionID'))} for k,v in tables['dogmaunits'].items()}
 defs={k:{'name':v['name'],'label':text(v.get('displayNameID')),'unitID':v.get('unitID')} for k,v in tables['dogmaattributes'].items()}
 attrs={k:[{'id':v['attributeID'],'value':v['value']} for v in row.get('dogmaAttributes',[])] for k,row in tables['typedogma'].items()}
 for values in attrs.values():
  assert len({v['id'] for v in values})==len(values)
  for v in values:assert str(v['id']) in defs
 schema=[]
 for id,row in sorted(recipes.items(),key=lambda x:int(x[0])):
  it=tables['recipeinputtrait'][id]['traits'];inputs=[]
  for x in tables['recipeinput'][id]['inputs']:
   inputs.append({'index':x['inputIndex'],'typeID':x.get('typeID'),'quantity':x['quantity'],'traits':[y['traitID'] for y in it if y['inputIndex']==x['inputIndex']]})
  schema.append({'id':int(id),'name':text(row.get('nameID')) or row['name'],'kind':row['recipeType'],'duration':row['duration'],'inputs':inputs,'outputs':[{'index':x['outputIndex'],'typeID':x['typeID'],'quantity':x['quantity']} for x in tables['recipeoutput'][id]['outputs']],'facilities':[{'typeID':int(k),'maxMultiplier':x['maxMultiplier']} for k,v in fac.items() for x in v['recipes'] if x['recipeID']==int(id)]})
 chem={'schemas':schema,'traits':{k:{'name':text(v.get('nameID')) or v['name'],'internalName':v['name'],'properties':tables['traitproperty'][k]['properties']} for k,v in traits.items()},'properties':{k:{**v,'label':text(v.get('nameID')) or v['name']} for k,v in properties.items()},'units':units,'neotypes':tables['neotypeproperty']}
 # Decode current client events with the independently constrained event schema reader.
 manifest=n/'manifests/stillness/resfileindex.txt';rows={r[0]:r for r in csv.reader(manifest.read_text().splitlines())};key='res:/staticdata/eventtypes.static';r=rows[key]
 assert re.fullmatch(r'[0-9a-f]{2}/[0-9a-f_]+',r[1]);payload=(args.client_root/'ResFiles'/r[1]).read_bytes();assert len(payload)==int(r[3]) and hashlib.md5(payload).hexdigest()==r[2];events=safe.decode_events(payload)
 files={}
 def write(file,data):
  raw=json.dumps({**HEAD,**data},ensure_ascii=False,separators=(',',':'),allow_nan=False).encode();assert len(raw)<25_000_000,file
  (out/(file+'.json')).write_bytes(raw);files[file]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
 write('catalog',{'items':[x for x in items if x['reference']]});write('catalog-all',{'items':items});write('chemistry',chem);write('attributes',{'types':attrs,'definitions':defs,'units':units});write('strings',{'strings':strings});write('events',{'events':events})
 rule_names=[k for k in tables if k.startswith(('propertyderivation','recipederivation','recipeoutputtransform','recipeoutputyield'))]
 write('chemistry-rules',{'tables':{k:tables[k] for k in rule_names}})
 patches=[('0.7.6.3','2026-11-11',['Old ore/mineral conversions accelerated.','Formulation withdrawals and partial-capacity storage deposits fixed.','Passive EM refit refresh, radial charge controls and Tribe map icons fixed.']),('0.7.6.2','2026-11-11',['Synthetic and specialist mining lenses accept heat/wear-resistant polishing materials; Recycled retains Cinderwrack.','Nearby online Field Storage supplies industry inputs.','R25/R50 footprint reduced; R50 fits LAI and VATRA.','Named legacy material conversions listed at 3 seconds; client duration fields differ.']),('0.7.6.1','2026-11-10',['Radial menu shortcut changed to Middle Mouse.','Material withdrawals, legacy conversions and loot quality fixes.']),('0.7.6.0','2026-11-10',['Digital Chemistry: schemas, material variants, traits and input-derived properties/yields.','EREV exploration Creation and VATRA hauler Creation.','3D Creation Manager and new radial menu.','Armilla, Calliphor and Histerid metamorphosis drones.','Discovery tracking, signature indicators and five-minute Refuge build time.'])]
 write('changes',{'latestPatch':'0.7.6.3','baselineBuild':'3573151','typeDelta':{'added':200,'removed':3,'changed':474},'patches':[{'version':v,'date':d,'url':'https://evefrontier.com/en/news/patch-notes-founder-access-'+v.replace('.','-')+'-vestiges','changes':c} for v,d,c in patches]})
 write('meta',{'snapshotDate':'2026-11-11','latestPatch':'0.7.6.3','counts':{'items':len(items),'clientTypes':len(t),'referenceItems':sum(x['reference'] for x in items),'apiItems':len(api),'schemas':len(schema),'traits':len(traits),'properties':len(properties),'strings':len(strings),'events':len(events)},'files':files.copy(),'provenance':{'inputsSha256':sha(n/'inputs.json'),'manifestSha256':sha(manifest),'decoderSha256':summary['decoderSha256'],'nativeTables':summary['tables'],'officialApi':apiproof,'clientFiles':proof['files'],'eventFile':{'resource':key,'md5':r[2],'sha256':hashlib.sha256(payload).hexdigest()},'scope':'Client definitions; live availability, effective fitted stats and variant yield evaluation unverified.'}})
 print(json.dumps(files,indent=2))
if __name__=='__main__':main()
