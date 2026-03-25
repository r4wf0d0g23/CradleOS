import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { RAW_CHARACTER_ID, RAW_NETWORK_NODE_ID, RAW_NODE_OWNER_CAP, SUI_RPC } from '../src/constants.js';
import { CradleOSClient } from '../src/cradleos-client.js';

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};

  const raw = readFileSync(filePath, 'utf8');
  const env: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

async function main() {
  const envPath = join(homedir(), '.openclaw', '.env');
  const fileEnv = parseEnvFile(envPath);
  const privateKey = process.env.EVE_VAULT_PRIVATE_KEY ?? fileEnv.EVE_VAULT_PRIVATE_KEY;

  const cradle = new CradleOSClient({ rpcUrl: SUI_RPC });
  const tx = cradle.buildOnlineNodeTx(RAW_CHARACTER_ID, RAW_NETWORK_NODE_ID, RAW_NODE_OWNER_CAP);

  if (!privateKey) {
    const bytes = await tx.build({ client: cradle.client, onlyTransactionKind: false });
    console.log('EVE_VAULT_PRIVATE_KEY not found. Unsigned transaction bytes (base64):');
    console.log(Buffer.from(bytes).toString('base64'));
    return;
  }

  const decoded = decodeSuiPrivateKey(privateKey);
  const keypair = Ed25519Keypair.fromSecretKey(decoded.secretKey);
  const sender = keypair.getPublicKey().toSuiAddress();
  tx.setSender(sender);

  const result = await cradle.client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });

  console.log('Network node online transaction submitted.');
  console.log(`Sender: ${sender}`);
  console.log(`Digest: ${result.digest}`);

  if (result.effects?.status) {
    console.log(`Status: ${result.effects.status.status}`);
    if (result.effects.status.error) {
      console.log(`Error: ${result.effects.status.error}`);
    }
  }
}

main().catch((error) => {
  console.error('Failed to build/submit online-node transaction.');
  console.error(error);
  process.exit(1);
});
