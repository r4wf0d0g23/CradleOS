"""Bounded native pilot runner, qualified isolated Wine prefixes and exact cleanup receipts.
Only this service's generated jobs are rotated; original runtime/client files are untouched.
"""
from pathlib import Path
import json, os, shutil, signal, subprocess, sys, time
ROOT=Path(__file__).resolve().parent
STATE=Path.home()/'.local/state/cradle-station'
STATE.mkdir(parents=True,exist_ok=True,mode=0o700)
os.environ.setdefault('STATION_IPC',f'/dev/shm/cradle-station-{os.getuid()}')
os.environ.setdefault('STATION_NATIVE_LIFETIME','28800')
GATE=Path('/home/rawdata/frontier-client/compat/.production-cleanup-required')
ACTIVE=STATE/'active-run.json'
def verified(job):
    try:
        receipts=list((job/'native').glob('*/receipt.json'))
        if len(receipts)!=1:return False
        payload=json.loads(receipts[0].read_text())
        return isinstance(payload,dict) and payload.get('wine_cleanup') is True
    except (OSError,ValueError):return False
def require_cleanup(job,reason):
    if not GATE.exists():GATE.write_text(json.dumps({'job':str(job),'reason':reason}))
if ACTIVE.exists():
    try:previous=Path(json.loads(ACTIVE.read_text())['job'])
    except (OSError,ValueError,KeyError,TypeError):
        require_cleanup(STATE,'Invalid station owned-run sentinel after interruption')
        raise SystemExit('Native cleanup requires inspection')
    if previous.parent!=STATE:
        require_cleanup(STATE,'Invalid station sentinel path')
        raise SystemExit('Invalid owned-run sentinel')
    if previous.exists() and not verified(previous):
        require_cleanup(previous,'Unfinished station run after supervisor interruption')
        raise SystemExit('Native cleanup requires inspection')
    ACTIVE.unlink()
stop=False
stop_at=None
child=None
def stopping(signum,frame):
    global stop,stop_at
    stop=True
    if stop_at is None:stop_at=time.monotonic()
    if child is not None and child.poll() is None:child.send_signal(signal.SIGTERM)
signal.signal(signal.SIGTERM,stopping)
signal.signal(signal.SIGINT,stopping)
# Keep the most recent two completed runtimes; archive receipts before removing generated copies.
def rotate():
    jobs=sorted(STATE.glob('job-*'))
    for job in jobs[:-2]:
        receipts=list((job/'native').glob('*/receipt.json'))
        if not verified(job):continue
        archive=STATE/'receipts';archive.mkdir(exist_ok=True)
        shutil.copy2(receipts[0],archive/(job.name+'.json'))
        if job.is_dir() and not job.is_symlink() and job.parent==STATE:shutil.rmtree(job)
while not stop:
    # Never retry through a qualified runtime cleanup gate.
    if Path('/home/rawdata/frontier-client/compat/.production-cleanup-required').exists():
        raise SystemExit('Native cleanup gate requires operator inspection')
    rotate()
    job=STATE/('job-'+str(time.time_ns()))
    pending=STATE/'active-run.next'
    pending.write_text(json.dumps({'job':str(job)}));pending.replace(ACTIVE)
    child=subprocess.Popen([sys.executable,str(ROOT/'run_stream.py'),str(ROOT/'assets/asset.json'),str(ROOT/'assets/station.cmf'),str(job)])
    while child.poll() is None:
        if stop_at is not None and time.monotonic()-stop_at>90:
            Path('/home/rawdata/frontier-client/compat/.production-cleanup-required').write_text(json.dumps({'job':str(job),'reason':'station renderer failed graceful stop; inspect owned processes before reuse'}))
            # The service cgroup owns the final kill deadline; mark the shared qualification gate first.
            child.wait(timeout=40)
        time.sleep(.25)
    rc=child.returncode;child=None
    if job.exists() and not verified(job):
        require_cleanup(job,'Station runner exited without a verified native cleanup receipt')
        raise SystemExit('Native cleanup requires inspection')
    ACTIVE.unlink(missing_ok=True)
    if rc and not stop:raise SystemExit(rc)
    if not stop:time.sleep(2)
