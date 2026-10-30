"""Build a fresh committed source archive with the exact committed world submodule."""
import io,json,pathlib,subprocess,tarfile,tempfile,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2];HERE=pathlib.Path(__file__).resolve().parent
SUI='/home/rawdata/.openclaw-captain/workspace/tools/sui-testnet-1.81.0/sui'
def git(*args,cwd=ROOT):return subprocess.check_output(['git',*args],cwd=cwd)
assert not git('status','--porcelain','--untracked-files=no').strip()
commit=git('rev-parse','HEAD').decode().strip();world=git('rev-parse','HEAD',cwd=ROOT/'world-contracts').decode().strip()
assert not git('status','--porcelain','--untracked-files=no',cwd=ROOT/'world-contracts').strip()
assert git('ls-tree','HEAD','world-contracts').decode().split()[2]==world
folder=pathlib.Path(tempfile.mkdtemp(prefix='cradleos-gate-release-'))
for payload,dest in [(git('archive',commit,'cradleos_gate'),folder),(git('archive',world,'contracts/world',cwd=ROOT/'world-contracts'),folder/'world-contracts')]:
 dest.mkdir(exist_ok=True,parents=True)
 with tarfile.open(fileobj=io.BytesIO(payload)) as archive:archive.extractall(dest,filter='data')
result=subprocess.run([SUI,'move','build','--path',str(folder/'cradleos_gate'),'--build-env','testnet_stillness','--dump-bytecode-as-base64','--no-tree-shaking'],capture_output=True,text=True)
assert result.returncode==0,result.stderr
fresh=json.loads(result.stdout);expected=json.loads((HERE/'package-build.json').read_text());assert fresh==expected
(HERE/'fresh-build.json').write_text(json.dumps(fresh,indent=2)+'\n')
(HERE/'clean-build.json').write_text(json.dumps({'sourceCommit':commit,'worldCommit':world,'exactBuildMatch':True,'freshDirectory':str(folder)},indent=2)+'\n')
print(json.dumps({'sourceCommit':commit,'exactBuildMatch':True}))
