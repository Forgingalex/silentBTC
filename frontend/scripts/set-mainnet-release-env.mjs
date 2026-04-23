import fs from 'node:fs';
import path from 'node:path';

const [, , contractPrincipal, targetFileArg] = process.argv;

if (!contractPrincipal || !contractPrincipal.includes('.')) {
  console.error('Usage: node scripts/set-mainnet-release-env.mjs <SP....contract-name> [target-env-file]');
  process.exit(1);
}

const [contractAddress, contractName] = contractPrincipal.split('.');

if (!contractAddress || !contractName) {
  console.error('Expected a full contract principal like SP....silent-bridge-mainnet');
  process.exit(1);
}

const targetFile = targetFileArg
  ? path.resolve(process.cwd(), targetFileArg)
  : path.resolve(process.cwd(), '.env.mainnet.local');

const lines = [
  'NEXT_PUBLIC_STACKS_NETWORK=mainnet',
  `NEXT_PUBLIC_CONTRACT_ADDRESS=${contractAddress}`,
  `NEXT_PUBLIC_CONTRACT_NAME=${contractName}`,
  'NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS=SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4',
  'NEXT_PUBLIC_SBTC_CONTRACT_NAME=sbtc-token',
  'NEXT_PUBLIC_SBTC_TOKEN_NAME=sbtc-token',
  'NEXT_PUBLIC_USDCX_CONTRACT_ADDRESS=',
  'NEXT_PUBLIC_USDCX_CONTRACT_NAME=',
  'NEXT_PUBLIC_USDCX_TOKEN_NAME=',
  'QUOTE_SOURCE_NAME=silentBTC internal quote engine',
  'QUOTE_SOURCE_ENDPOINT=https://YOUR_DOMAIN/api/quote',
  'QUOTE_STX_USD=2.25',
  'QUOTE_BTC_USD=78000',
  'QUOTE_FEE_BPS=30',
  'QUOTE_SLIPPAGE_BPS=50',
  'QUOTE_FRESHNESS_SECONDS=30',
  'QUOTE_TTL_SECONDS=30',
  'QUOTE_FALLBACK_SOURCE=none; solver pauses if the primary quote source is unavailable',
  'QUOTE_LOGGING_DESTINATION=solver application logs',
  '',
];

fs.writeFileSync(targetFile, lines.join('\n'), 'utf8');
console.log(`Wrote ${targetFile}`);
