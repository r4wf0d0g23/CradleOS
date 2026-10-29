"""Read-only build/provenance checks and an external witness-construction attack."""
import base64, hashlib, json, pathlib, re, subprocess, tomllib
ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
SUI = '/home/rawdata/.openclaw-captain/workspace/tools/sui-testnet-1.81.0/sui'
source = ROOT / 'cradleos_storefront/sources/storefront.move'
data = json.loads((HERE / 'package-build.json').read_text())
world = tomllib.loads((ROOT/'world-contracts/contracts/world/Published.toml').read_text())['published']['testnet_stillness']['original-id']
bytecode = base64.b64decode(data['modules'][0])
assert bytes.fromhex(world[2:]) in bytecode
assert world in data['dependencies']
assert len(data['modules']) == 1
assert b'new_auth' not in bytecode
assert b'withdraw_item' not in bytecode and b'deposit_item' not in bytecode
# Only claim transfers Coin; no Item or witness export. ABI reviewed independently.
attack = HERE/'attacker'
(attack/'sources').mkdir(parents=True, exist_ok=True)
(attack/'Move.toml').write_text('[package]\nname = "storage_attacker"\nedition = "2024"\n[dependencies]\ncradleos_storefront = { local = "../../../cradleos_storefront" }\n[environments]\ntestnet_stillness = "4c78adac"\n')
checks=[]
for name,code,error in [
 ('external_witness_constructor', 'public fun steal(): sa::StorefrontAuth { sa::StorefrontAuth {} }', 'can only be instantiated within its defining module'),
 ('old_constructor_missing', 'public fun steal(): sa::StorefrontAuth { sa::new_auth() }', 'unbound module member'),
]:
 (attack/'sources/attack.move').write_text('module storage_attacker::attack;\nuse cradleos_storefront::storefront as sa;\n'+code+'\n')
 result=subprocess.run([SUI,'move','build','--path',str(attack),'--build-env','testnet_stillness'],capture_output=True,text=True)
 log=result.stdout+result.stderr
 (HERE/(name+'.log')).write_text(log)
 assert result.returncode != 0 and error in log, log
 checks.append(name)
receipt={'world':world,'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'bytecodeSHA256':hashlib.sha256(bytecode).hexdigest(),'dependencies':data['dependencies'],'modules':1,'externalAttacksRejected':checks,'noWitnessOrItemExport':True}
(HERE/'package-checks.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
