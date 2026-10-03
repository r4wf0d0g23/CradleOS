import collections, hashlib, pickle, struct, tempfile, unittest
from pathlib import Path
from extract_game_data import loads, verified_resource, build_strings, decode_events, official_types

class ExtractionTests(unittest.TestCase):
    def test_pickle_globals_are_rejected(self):
        with self.assertRaises(pickle.UnpicklingError): loads(b'cos\nsystem\n.')
        self.assertEqual(loads(pickle.dumps(collections.OrderedDict(a=1))),{'a':1})

    def test_resource_requires_size_and_hash(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);path=root/'ResFiles/ab/abcdef';path.parent.mkdir(parents=True);path.write_bytes(b'checked')
            name='res:/staticdata/example.static'
            manifest={name:[name,'ab/abcdef',hashlib.md5(b'checked').hexdigest(),'7']}
            self.assertEqual(verified_resource(root,manifest,name)[0],b'checked')
            path.write_bytes(b'changed')
            with self.assertRaises(ValueError): verified_resource(root,manifest,name)
            manifest[name][1]='../../private'
            with self.assertRaises(ValueError): verified_resource(root,manifest,name)

    def test_localization_identity_and_placeholder_filter(self):
        result,total,numeric=build_strings(('en-us',{1032759:('Heavy Storage',None,None),99:('12345',None,None),100:('',None,None)}))
        self.assertEqual(result,{'1032759':'Heavy Storage'})
        self.assertEqual((total,numeric),(3,1))
        with self.assertRaises(ValueError):build_strings(('wrong-language',{}))

    def test_official_catalog_pagination_and_identity(self):
        item={'id':77917,'name':'Heavy Storage','categoryName':'Deployable'}
        anonymous={'id':95936,'name':'','categoryName':'Asteroid'}
        data={'metadata':{'offset':0,'total':2,'limit':1000},'data':[item,anonymous]}
        self.assertEqual({r['id'] for r in official_types(data)},{77917,95936})
        data['metadata']['total']=3
        with self.assertRaises(ValueError):official_types(data)
        data['metadata']['total']=2;data['data']=[item,item]
        with self.assertRaises(ValueError):official_types(data)

    def test_event_layout_and_corruption(self):
        schema={'type':'dict','keyTypes':{'type':'int'},'valueTypes':{'type':'object','attributes':{'eventTypeName':{'type':'string'}},'endOfFixedSizeData':0,'attributesWithVariableOffsets':['eventTypeName'],'optionalValueLookups':{}}}
        raw_schema=pickle.dumps(schema)
        name=b'Ranged Player Damage (EM)'
        record=bytes(12)+struct.pack('<I',len(name))+name
        blob=record+struct.pack('<IiII',1,4,0,12)
        payload=struct.pack('<I',len(raw_schema))+raw_schema+struct.pack('<I',len(blob))+blob
        self.assertEqual(decode_events(payload),{'4':{'eventTypeName':name.decode()}})
        with self.assertRaises(ValueError):decode_events(payload[:-1])
        malformed=bytearray(payload);malformed[8+len(raw_schema)]=1
        with self.assertRaises(ValueError):decode_events(bytes(malformed))

if __name__=='__main__': unittest.main()
