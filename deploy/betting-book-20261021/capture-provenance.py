"""Capture actual clean build evidence; never publish or invent chain IDs."""
from pathlib import Path
import json, hashlib, re, shutil
root=Path(__file__).resolve().parents[2]
r=root/'deploy/betting-book-20261021'
b=Path(json.loads((r/'clean-build-path.json').read_text())['path'])/'build/cradleos_book'
expected=['book','delivery','price']
assert sorted(p.stem for p in (b/'bytecode_modules').glob('*.mv'))==expected
allowed={'0'*64,'0'*63+'1','0'*63+'2','7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92','d1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd','e79f4e3e02ce132f40f39e73220493a802329d3cb6ad7f789e98a78910fc0053'}
abi=[];hashes={};imports=set()
for name in expected:
 data=(b/'bytecode_modules'/f'{name}.mv').read_bytes()
 assert data==(root/'cradleos_book/build/cradleos_book/bytecode_modules'/f'{name}.mv').read_bytes()
 for marker in [b'setup_for_testing',b'decode_for_testing',b'new_fleet_draft',b'create_market',b'submit_proof']:
  assert marker not in data,(name,marker)
 dis=(b/'disassembly'/f'{name}.mvb').read_text();imports.update(re.findall(r'^use ([a-f0-9]+)::',dis,re.M));hashes[name]=hashlib.sha256(data).hexdigest()
 abi.append(f'## {name}\n'+'\n'.join(line for line in dis.splitlines() if line.startswith('use ') or line.startswith('public')))
assert imports<=allowed,imports-allowed
sim=json.loads((r/'publish-dryrun.json').read_text());assert sim['effects']['status']['status']=='success'
(r/'abi-public.txt').write_text('CURRENT production ABI — staged, not published. public(friend) is package-only.\n\n'+'\n\n'.join(abi)+'\n')
shutil.copy2(b.parent.parent/'Move.lock',r/'dependency-lock.toml')
paths=[root/'cradleos_book/Move.toml',root/'cradleos_book/Move.lock']+list((root/'cradleos_book/sources').glob('*.move'))+list((root/'cradleos_book/tests').glob('*.move'))
paths += [root/'cradleos-dapp/src/lib'/s for s in ['bookDeployment.ts','bettingBook.ts','bettingBook.test.ts','transactionCompatibility.ts']]
paths += [root/'cradleos-dapp/src/components'/s for s in ['BettingBookPanel.tsx','BettingBookPanel.css','DeliveryBoard.tsx','CasinoExperience.tsx']]
paths += list((root/'cradleos-dapp/scripts/book-keeper').glob('*'))
prov={'status':'staged-not-published','environment':'testnet_stillness','chainId':'4c78adac','worldSourceCommit':'d33ff232bd3878e8f9ad0721e18564b21facc925','pythSourceCommit':'6c78a4d882daf4d91457ad5142cb58fc7e376f98','moveModules':expected,'bytecodeSha256':hashes,'assertions':{'testOnlyAndCombatAbsent':True,'onlyPinnedDependencyOrigins':True,'cleanArtifactMatchesPublicationDryrunBuild':True,'unsignedPublicationSimulationSucceeded':True,'noPublicationPerformed':True},'sourceSha256':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},'frontendDistSha256':{str(p.relative_to(root/'cradleos-dapp/dist')):hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'cradleos-dapp/dist/index.html']+list((root/'cradleos-dapp/dist/assets').glob('index-*'))},'sourceCommit':None,'sourceTag':'publish/cradleos_book-oracle-2026-10-21'}
(r/'provenance.json').write_text(json.dumps(prov,indent=2)+'\n')
print('Provenance assertions passed; modules',expected,'imports',len(imports))
