"""Verify an existing pinned off-host backup without sending or returning keys."""
import base64
import datetime
import json
from pathlib import Path
import secrets
import shlex
import subprocess

ROOT = Path('/home/rawdata/.openclaw-captain/workspace/research/eve-cycle7-clean-wipe-20261002')
EXPECTED = '0x177583b2ee07dc6ce8056e49fda83637c996b9143adf651a8de5ebe03699b91a'
checked = datetime.datetime.now(datetime.timezone.utc).isoformat()
challenge = ('CradleOS gate release backup proof ONLY. Not a transaction. ' + checked + ' ' + secrets.token_hex(32)).encode()
encoded = base64.b64encode(challenge).decode()
remote = r'''
import base64, hashlib, json, os, pathlib, pwd, socket, stat, sys, tempfile
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
try:
    os.umask(0o077)
    expected, encoded, checked = sys.argv[1:]
    assert socket.gethostname() == 'agent-nav-jetson2'
    assert os.geteuid() == pwd.getpwnam('agent-nav').pw_uid
    base = pathlib.Path.home() / '.local/share/cradleos-backups'
    directory = base / ('deploy-wallet-' + expected[2:])
    target = directory / 'sui.keystore'
    for parent in [base, directory]:
        st = parent.lstat()
        assert stat.S_ISDIR(st.st_mode) and st.st_uid == os.geteuid() and stat.S_IMODE(st.st_mode) == 0o700
    fd = os.open(target, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, 'rb') as original:
        st = os.fstat(original.fileno())
        assert stat.S_ISREG(st.st_mode) and st.st_uid == os.geteuid() and stat.S_IMODE(st.st_mode) == 0o600 and st.st_nlink == 1
        contents = original.read(8193)
        assert len(contents) <= 8192
    # Restore from the existing backup, not the live publisher or incoming key material.
    with tempfile.TemporaryDirectory(prefix='.book-restore-proof-', dir=base) as temp:
        restored = pathlib.Path(temp) / 'sui.keystore'
        restored.write_bytes(contents)
        restored.chmod(0o600)
        keys = json.loads(restored.read_text())
        assert isinstance(keys, list) and len(keys) == 1
        raw = base64.b64decode(keys[0], validate=True)
        assert len(raw) == 33 and raw[0] == 0
        key = Ed25519PrivateKey.from_private_bytes(raw[1:])
        public = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
        address = '0x' + hashlib.blake2b(b'\x00' + public, digest_size=32).hexdigest()
        assert address == expected
        challenge = base64.b64decode(encoded, validate=True)
        assert challenge.startswith(b'CradleOS gate release backup proof ONLY. Not a transaction.') and len(challenge) < 2048
        length, prefix = len(challenge), bytearray()
        while length >= 128:
            prefix.append((length & 127) | 128)
            length >>= 7
        prefix.append(length)
        digest = hashlib.blake2b(b'\x03\x00\x00' + prefix + challenge, digest_size=32).digest()
        signature = key.sign(digest)
        key.public_key().verify(signature, digest)
    print(json.dumps({'host':socket.gethostname(),'wallet':address,'backupPath':str(target),'restoredFromBackup':True,'created':False,'fileMode':'0600','directoryMode':'0700','challengeBase64':encoded,'digestHex':digest.hex(),'signature':base64.b64encode(b'\x00'+signature+public).decode(),'signatureType':'SuiPersonalMessage','checkedAt':checked,'transactionSubmitted':False}))
except Exception:
    print(json.dumps({'error':'EXISTING_BACKUP_PROOF_FAILED; secret-bearing details suppressed'}))
    sys.exit(1)
'''
command = ['ssh', '-i', '/home/rawdata/.ssh/id_ed25519', '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'StrictHostKeyChecking=yes', '-o', 'UserKnownHostsFile=' + str(ROOT / 'jetson2-known-hosts'), 'agent-nav@100.95.204.125', shlex.join(['python3', '-', EXPECTED, encoded, checked])]
result = subprocess.run(command, input=remote, text=True, capture_output=True, timeout=30)
if result.returncode:
    raise SystemExit('Pinned remote backup proof failed; no key material logged.')
proof = json.loads(result.stdout)
assert proof['challengeBase64'] == encoded and proof['wallet'] == EXPECTED and proof['checkedAt'] == checked
assert proof['restoredFromBackup'] and not proof['transactionSubmitted']
verifier = r'''
import {verifyPersonalMessageSignature} from '/home/rawdata/.openclaw-captain/workspace/worktrees/cradleos-cycle7-20261002/cradleos-dapp/node_modules/@mysten/sui/dist/verify/index.mjs';
let input=''; for await (const c of process.stdin) input+=c;
const proof=JSON.parse(input);
const key=await verifyPersonalMessageSignature(Buffer.from(proof.challengeBase64,'base64'),proof.signature);
if(key.toSuiAddress()!==proof.wallet) throw Error('Proof identity mismatch');
console.log(JSON.stringify({valid:true,address:key.toSuiAddress(),kind:'Sui PersonalMessage',checkedAt:new Date().toISOString()}));
'''
verified = subprocess.run(['node', '--input-type=module', '-e', verifier], input=json.dumps(proof), text=True, capture_output=True, check=True)
proof['independentSdkVerification'] = json.loads(verified.stdout)
output = Path(__file__).resolve().parent / 'restored-signing-proof.json'
output.write_text(json.dumps(proof, indent=2) + '\n')
print(json.dumps({'valid':True,'host':proof['host'],'wallet':EXPECTED,'checkedAt':checked,'digestHex':proof['digestHex'],'receipt':str(output),'transactionSubmitted':False}))
