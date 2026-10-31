#!/usr/bin/env python3
"""Consistent read-only SQLite archive, copied and verified on authorized Jetson2."""
import datetime, hashlib, json, os, pathlib, sqlite3, subprocess
os.umask(0o077)
root=pathlib.Path.home()/'.local/share/cradleos-known-space'
source=root/'cycle7.sqlite'
assert source.is_file(), 'Missing archive'
out=root/'backups'/('cycle7-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.sqlite')
out.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
with sqlite3.connect('file:'+str(source)+'?mode=ro',uri=True) as src, sqlite3.connect(out) as dest:
    src.backup(dest)
    assert dest.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    counts=dict(dest.execute('SELECT source,count(*) FROM events GROUP BY source').fetchall())
sha=hashlib.sha256(out.read_bytes()).hexdigest()
ssh=['ssh','-i',str(pathlib.Path.home()/'.ssh/id_ed25519'),'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=15','-o','UserKnownHostsFile=/home/rawdata/.openclaw-captain/workspace/research/eve-cycle7-clean-wipe-20261002/jetson2-known-hosts','agent-nav@100.95.204.125']
remote='cradleos-known-space-backups/'+out.name
subprocess.run(ssh+['umask 077; mkdir -p cradleos-known-space-backups; cat > '+remote],input=out.read_bytes(),check=True,timeout=90)
proof=subprocess.check_output(ssh+['python3 -c '+__import__('shlex').quote("import hashlib,sqlite3,json,pathlib;p=pathlib.Path("+repr(remote)+");db=sqlite3.connect('file:'+str(p)+'?mode=ro',uri=True);print(json.dumps({'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'integrity':db.execute('PRAGMA integrity_check').fetchone()[0]}))")],timeout=30)
result=json.loads(proof);assert result['sha256']==sha and result['integrity']=='ok'
print(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'host':'Jetson2','file':out.name,'sha256':sha,'integrity':'ok','events':counts}))
