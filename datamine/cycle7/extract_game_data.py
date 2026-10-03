#!/usr/bin/env python3
"""Reproducible, fail-closed Cycle 7 Game Data snapshot. No launcher credentials."""
import argparse, collections, configparser, csv, hashlib, io, json, pickle, re, struct
from pathlib import Path
from datetime import datetime, timezone

BUILD = '3573151'
WORLD = '0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92'
API = 'https://world-api-stillness.live.pub.evefrontier.com/v2/types?limit=1000'

class DataUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if (module, name) == ('collections', 'OrderedDict'):
            return collections.OrderedDict
        raise pickle.UnpicklingError('Unexpected pickle global')
    def persistent_load(self, pid):
        raise pickle.UnpicklingError('Persistent pickle references forbidden')

def loads(data):
    return DataUnpickler(io.BytesIO(data), encoding='latin1').load()

def sha(data): return hashlib.sha256(data).hexdigest()

def verified_resource(root, manifest, resource):
    row = manifest[resource]
    relative, md5, size = row[1:4]
    if not re.fullmatch(r'[0-9a-f]{2}/[0-9a-f_]+', relative):
        raise ValueError('Invalid cache path')
    path = root / 'ResFiles' / relative
    if not path.resolve().is_relative_to((root / 'ResFiles').resolve()):
        raise ValueError('Escaping resource path')
    payload = path.read_bytes()
    if len(payload) != int(size) or hashlib.md5(payload).hexdigest() != md5:
        raise ValueError('Missing/incomplete/unverified resource: ' + resource)
    return payload, {'resource': resource, 'bytes': len(payload), 'md5': md5, 'sha256': sha(payload)}

def decode_events(payload):
    """Read this explicitly validated dict<int, object{eventTypeName:string}> layout.
    Reject other schemas/layouts instead of heuristic fallback to meaningless data.
    """
    if len(payload) < 12: raise ValueError('Short static file')
    size = struct.unpack_from('<I', payload)[0]
    if not 8 <= size <= len(payload) - 8: raise ValueError('Invalid schema size')
    schema = loads(payload[4:4+size])
    value = schema.get('valueTypes', {})
    if (schema.get('type') != 'dict' or schema.get('keyTypes',{}).get('type') != 'int'
        or value.get('type') != 'object' or dict(value.get('attributes',{})) != {'eventTypeName': {'type': 'string'}}
        or value.get('endOfFixedSizeData') != 0 or value.get('attributesWithVariableOffsets') != ['eventTypeName']
        or value.get('optionalValueLookups') != {}):
        raise ValueError('Unexpected event schema')
    blob_size = struct.unpack_from('<I', payload, size+4)[0]
    blob = payload[size+8:]
    if blob_size != len(blob) or len(blob) < 8: raise ValueError('Invalid blob length')
    footer_size = struct.unpack_from('<I', blob, len(blob)-4)[0]
    if not 4 <= footer_size <= len(blob)-4: raise ValueError('Invalid footer')
    footer = len(blob)-4-footer_size
    count = struct.unpack_from('<I', blob, footer)[0]
    if 4+count*8 != footer_size or count==0: raise ValueError('Invalid event count')
    out = {}
    for i in range(count):
        key, offset = struct.unpack_from('<iI', blob, footer+4+i*8)
        # Current single-string object: three zero u32 words before the
        # length-prefixed string. Reject any other layout, never guess offsets.
        if offset+16 > footer or blob[offset:offset+12] != bytes(12):
            raise ValueError('Invalid event object header')
        offset += 12
        n = struct.unpack_from('<I', blob, offset)[0]
        if not 0 < n <= footer-offset-4: raise ValueError('Invalid event name length')
        name = blob[offset+4:offset+4+n].decode('utf-8')
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_ .:()/+-]*', name): raise ValueError('Invalid event name: '+repr(name))
        if str(key) in out: raise ValueError('Duplicate event ID')
        out[str(key)] = {'eventTypeName': name}
    return out

def build_strings(english):
    if not isinstance(english, tuple) or len(english)!=2 or english[0]!='en-us' or not isinstance(english[1],dict):
        raise ValueError('Unexpected English localization format')
    strings = {}
    numeric = 0
    for message_id, row in english[1].items():
        if not isinstance(message_id,int) or isinstance(message_id,bool) or not isinstance(row,tuple) or not row or not isinstance(row[0],str):
            raise ValueError('Unexpected localization record')
        text=row[0].strip()
        if not text: continue
        if text.isdigit(): numeric+=1; continue
        strings[str(message_id)]=text
    return strings, len(english[1]), numeric

def official_types(response):
    data, metadata=response['data'], response['metadata']
    if metadata['offset']!=0 or metadata['total']!=len(data) or metadata['limit']<len(data):
        raise ValueError('Incomplete official catalog pagination')
    ids=set()
    for row in data:
        if type(row['id']) is not int or row['id']<=0 or row['id'] in ids or not isinstance(row['name'],str):
            raise ValueError('Invalid/duplicate official type')
        ids.add(row['id'])
    return sorted(data,key=lambda row:(row['categoryName'], row['name'].casefold(),row['id']))

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--client-root',type=Path,required=True)
    ap.add_argument('--types',type=Path,required=True)
    ap.add_argument('--api-proof',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args();root=args.client_root
    start=(root/'stillness/start.ini').read_bytes();cfg=configparser.ConfigParser();cfg.read_string(start.decode())
    if (cfg['main']['build'],cfg['main']['codename'],cfg['main']['branch'])!=(BUILD,'cycle-7','//frontier/cycle-7'):
        raise ValueError('Unreviewed client build; audit before changing BUILD')
    raw_manifest=(root/'stillness/resfileindex.txt').read_bytes()
    rows=list(csv.reader(io.StringIO(raw_manifest.decode()))); manifest={r[0]:r for r in rows}
    if len(manifest)!=len(rows):raise ValueError('Duplicate manifest resource')
    provenance=[]
    def read(resource):
        payload,entry=verified_resource(root,manifest,resource);provenance.append(entry);return payload
    strings,total,numeric=build_strings(loads(read('res:/localizationfsd/localization_fsd_en-us.pickle')))
    events=decode_events(read('res:/staticdata/eventtypes.static'))
    opaque=['types','groups','categories','typedogma','dogmaattributes','industry_blueprints','industry_facilities','typematerials']
    for name in opaque:
        read('res:/staticdata/'+name+'.fsdbinary')
        provenance[-1]['decodeStatus']='Not decoded; no stats or recipes inferred from this binary.'
    types_raw=args.types.read_bytes();proof=json.loads(args.api_proof.read_text())
    if proof['url']!=API or proof['status']!=200 or proof['sha256']!=sha(types_raw):raise ValueError('Official API proof mismatch')
    catalog=official_types(json.loads(types_raw))
    if (root/'stillness/resfileindex.txt').read_bytes()!=raw_manifest or (root/'stillness/start.ini').read_bytes()!=start:
        raise ValueError('Client changed during collection')
    meta={'schemaVersion':1,'cycle':7,'name':'Vestiges','server':'Stillness','world':WORLD,'build':BUILD,'clientVersion':cfg['main']['version'],
      'extractedAt':datetime.now(timezone.utc).isoformat(),'manifestSha256':sha(raw_manifest),'manifestRows':len(rows),
      'officialApi':proof,'counts':{'items':len(catalog),'unnamedItems':sum(not r['name'].strip() for r in catalog),'strings':len(strings),'stringsTotal':total,'numericPlaceholdersExcluded':numeric,'eventTypes':len(events)},
      'clientFiles':provenance,'coverage':['Item IDs and physical metadata come from the published Stillness World API, not localization message IDs.',
        'Client text is a localization snapshot; presence in the client does not prove an item or feature is obtainable.',
        'Event types are internal client definitions, not a list of Sui contract events.',
        'Client binary recipes, dogma/combat stats and current 3D geometry have not been decoded. No previous-cycle values are substituted.']}
    args.out.mkdir(parents=True,exist_ok=True)
    for name,value in [('meta',meta),('items',catalog),('strings',strings),('events',events)]:
        (args.out/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'),sort_keys=True)+'\n')
    print(json.dumps({'counts':meta['counts'],'build':BUILD},indent=2))

if __name__=='__main__': main()
