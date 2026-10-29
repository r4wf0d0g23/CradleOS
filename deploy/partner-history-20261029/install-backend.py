import pathlib,subprocess,os,shutil,datetime,json,hashlib
repo=pathlib.Path(__file__).resolve().parents[2]
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
home=pathlib.Path('/home/rawdata'); source=repo/'services/partner-metrics'
runtime=home/'cradleos-partner-metrics'; release=runtime/'releases'/sha
release.mkdir(parents=True,exist_ok=True,mode=0o700)
for name in ['report.mjs','collect.mjs','handler.mjs','history-model.mjs']:
 shutil.copy2(source/name,release/name)
link=runtime/'current.next'
if link.is_symlink():link.unlink()
link.symlink_to(release);link.replace(runtime/'current')
units=home/'.config/systemd/user'
for name in ['cradleos-partner-metrics.service','cradleos-partner-metrics.timer']:shutil.copy2(source/name,units/name)
subprocess.run(['systemctl','--user','daemon-reload'],check=True)
subprocess.run(['systemctl','--user','start','cradleos-partner-metrics.service'],check=True)
# Only expose the endpoint after the real sandboxed service has collected.
server=home/'cradleos-agent-proxy/server.js';before=server.read_bytes()
backup=home/'cradleos-agent-proxy/backups'/('partner-metrics-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(parents=True,mode=0o700);(backup/'server.js').write_bytes(before);os.chmod(backup/'server.js',0o600)
s=before.decode();imp='import { handlePartnerHistory } from "../cradleos-partner-metrics/current/handler.mjs";\n';route='app.get("/telemetry/history", handlePartnerHistory);'
if imp not in s:s=imp+s
if route not in s:
 needle='app.get("/telemetry/combined", handleCombinedMau);'
 assert s.count(needle)==1
 s=s.replace(needle,needle+'\n'+route)
server.write_text(s)
subprocess.run(['node','--check',str(server)],check=True)
subprocess.run(['systemctl','--user','restart','cradleos-agent.service'],check=True)
subprocess.run(['systemctl','--user','enable','--now','cradleos-partner-metrics.timer'],check=True)
info=json.loads((home/'.config/cradleos-partner-metrics/credential-info.json').read_text())
receipt={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCommit':sha,'runtime':str(release),'backup':str(backup),'serverBefore':hashlib.sha256(before).hexdigest(),'serverAfter':hashlib.sha256(server.read_bytes()).hexdigest(),'credentialPermissions':info['permissions'],'credentialMode':oct((home/'.config/cradleos-partner-metrics/cloudflare-token').stat().st_mode&0o777),'archiveMode':oct((home/'.local/share/cradleos-partner-metrics/archive.db').stat().st_mode&0o777),'sourceDbAccess':'read-only','scheduler':'hourly user timer','collectorService':'sandboxed real run passed'}
(repo/'deploy/partner-history-20261029/backend-install.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
