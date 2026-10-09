import json,pathlib,sqlite3,subprocess,time,uuid,base64
out=pathlib.Path('deploy/activity-counter-20261009');report={}
def get(url,body=None):
 cmd=['curl','-sS','--max-time','20','-D','-','-H','Origin: https://cradleos.io',url]
 if body is not None:cmd+=['-H','Content-Type: application/json','--data-binary','@-']
 raw=subprocess.check_output(cmd,input=json.dumps(body).encode() if body is not None else None).decode()
 blocks=raw.replace('\r\n','\n').split('\n\n');header=blocks[-2];content=blocks[-1]
 headers=dict(line.split(': ',1) for line in header.splitlines()[1:] if ': ' in line)
 return {'status':int(header.splitlines()[0].split()[1]),'cors':headers.get('access-control-allow-origin'),'cache':headers.get('cache-control'),'data':json.loads(content)}
report['public']=get('https://keeper.reapers.shop/telemetry/combined');report['health']=get('https://keeper.reapers.shop/health')
assert report['public']['status']==200 and report['public']['data']['onchain_status']=='current'
assert report['public']['cors']=='*' and report['public']['cache']=='no-store'
assert report['health']['data']['keeper']=='retired'
challenge=f'CradleOS identity verification\nNonce: {uuid.uuid4()}\nTimestamp: {int(time.time()*1000)}'
report['invalid_proof']=get('https://keeper.reapers.shop/telemetry/verify',{'address':'0x1','signature':'deliberately-invalid','challenge':base64.b64encode(challenge.encode()).decode()})
assert report['invalid_proof']['status']==401
report['retired_route']=get('https://keeper.reapers.shop/v1/models');assert report['retired_route']['status']==410
con=sqlite3.connect('file:/home/rawdata/cradleos-agent-proxy/telemetry.db?mode=ro',uri=True)
report['legacy_row_counts_after']={t:con.execute('select count(*) from '+t).fetchone()[0] for t in ['wallet_pings','onchain_pings','onchain_cursor']}
report['db_distinct_chain_wallets']=con.execute('select count(distinct address) from activity_chain_v2').fetchone()[0]
report['new_verified_proof_rows']=con.execute('select count(*) from activity_wallet_v2').fetchone()[0]
assert report['db_distinct_chain_wallets']==report['public']['data']['onchain_mau']
assert report['legacy_row_counts_after']==json.loads((out/'backend-install.json').read_text())['legacy_row_counts_before']
(out/'backend-live.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'public_status':report['public']['status'],'chain_wallets':report['db_distinct_chain_wallets'],'new_proofs':report['new_verified_proof_rows'],'invalid_proof_rejected':report['invalid_proof']['status'],'retired_guard':report['retired_route']['status'],'legacy_rows_preserved':True}))
