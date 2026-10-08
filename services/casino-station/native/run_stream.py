import argparse
import fcntl
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import os
import signal

ROOT=Path(__file__).resolve().parent
COMPAT=Path('/home/rawdata/frontier-client/compat')


def render(asset,cmf,output,frames,cinematic=False,rift=False):
    if frames < 0 or frames > 480 or frames % 2:
        raise ValueError('Frames must be even and between 0 and 480')
    if rift and (frames<6 or cinematic):
        raise ValueError('Rift capture requires at least six frames and its own camera')
    with (COMPAT/'.production-render.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if (COMPAT/'.production-cleanup-required').exists():
            raise RuntimeError('Runtime cleanup gate requires inspection')
        output.mkdir(parents=True,exist_ok=False)
        overlay=output/'prepared-host'
        overlay.mkdir()
        for name in ('trinity-build','msvc','sdk17763-unpacked','runtime','toolchain','dxvk','reports'):
            (overlay/name).symlink_to(COMPAT/name,target_is_directory=True)
        smoke=overlay/'smoke'
        smoke.mkdir()
        for name in ('run_trinity_probe.py','blue_bootstrap.cpp','trinity_device_probe.py','verify_al_capture.py','verify_asset_capture.py'):
            shutil.copy2(COMPAT/'smoke'/name,smoke/name)
        runner=smoke/'run_trinity_probe.py'
        runner.write_text(runner.read_text().replace('300 if options.ship else 120','int(__import__("os").environ.get("STATION_NATIVE_LIFETIME","28800"))+120 if options.ship else 120'))
        config={'asset':str(asset.resolve()),'cmf':str(cmf.resolve()),'frames':frames,'cinematic':cinematic,'rift':rift,
            'asset_sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),'cmf_sha256':hashlib.sha256(cmf.read_bytes()).hexdigest()}
        config['texture_hashes']={str(path.relative_to(asset.parent)):hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(asset.parent.glob('*.png'))}
        config['source_hashes']={path.name:hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(ROOT.glob('*')) if path.is_file()}
        config['ipc']=os.environ['STATION_IPC']
        config['lifetime']=int(os.environ.get('STATION_NATIVE_LIFETIME','28800'))
        ipc=Path(config['ipc']);ipc.mkdir(parents=True,exist_ok=True,mode=0o700)
        (ipc/'shutdown').unlink(missing_ok=True)
        (ipc/'heartbeat.json').unlink(missing_ok=True)
        def shutdown(signum,frame):
            (ipc/'shutdown').write_text('stop')
        signal.signal(signal.SIGTERM,shutdown)
        signal.signal(signal.SIGINT,shutdown)
        config_path=output/'config.json'
        config_path.write_text(json.dumps(config,indent=2))
        if rift:
            worker=(ROOT/'custom_ship.py').read_text()+'\n'+(ROOT/'rift_scene.py').read_text().replace('__CONFIG_PATH__',str(config_path.resolve()))
        else:
            worker=(ROOT/'cinema_camera.py').read_text()+'\n'+(ROOT/'stream_scene.py').read_text().replace('__CONFIG_PATH__',str(config_path.resolve()))
        config['worker_sha256']=hashlib.sha256(worker.encode()).hexdigest()
        config_path.write_text(json.dumps(config,indent=2))
        (smoke/'trinity_ship_probe.py').write_text(worker)
        with (output/'render.log').open('w') as log:
            process=subprocess.Popen([sys.executable,str(smoke/'run_trinity_probe.py'),'--ship','--output-root',str(output/'native')],
                stdout=log,stderr=subprocess.STDOUT)
            try:
                process.wait(timeout=config['lifetime']+240)
            except BaseException:
                process.terminate()
                try:
                    process.wait(timeout=90)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                (COMPAT/'.production-cleanup-required').write_text(json.dumps({'job':str(output),'reason':'interrupted custom render requires cleanup inspection'}))
                raise
        try:
            runs=list((output/'native').iterdir())
            if len(runs)!=1:
                raise RuntimeError('Ambiguous native output')
            receipt=json.loads((runs[0]/'receipt.json').read_text())
            if receipt.get('wine_cleanup') is not True:
                raise RuntimeError('Native cleanup failed')
        except Exception:
            (COMPAT/'.production-cleanup-required').write_text(json.dumps({'job':str(output),'reason':'custom asset native cleanup unverified'}))
            raise
        if process.returncode or receipt.get('wine_cleanup') is not True:
            raise RuntimeError('Native custom asset run failed: '+str(runs[0]))
        print(runs[0])


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('asset',type=Path)
    parser.add_argument('cmf',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--frames',type=int,default=0)
    parser.add_argument('--cinematic',action='store_true')
    parser.add_argument('--rift',action='store_true')
    args=parser.parse_args()
    render(args.asset.resolve(),args.cmf.resolve(),args.output.resolve(),args.frames,args.cinematic,args.rift)
