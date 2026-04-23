import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

export type StacksNetworkName = 'mainnet' | 'testnet';

export const STACKS_NETWORK: StacksNetworkName =
  process.env.NEXT_PUBLIC_STACKS_NETWORK === 'testnet' ? 'testnet' : 'mainnet';

export const network = STACKS_NETWORK === 'testnet' ? STACKS_TESTNET : STACKS_MAINNET;

const appOrigin =
  typeof window !== 'undefined' ? window.location.origin : 'https://silentbtc.app';

export const appDetails = {
  name: 'silentBTC',
  icon: `${appOrigin}/logo.png`,
};

const TESTNET_CONTRACT_ADDRESS = 'ST802YSF654B96WRF9Z5XHH9SMB5VWHWYM0D422A';
const MAINNET_CONTRACT_ADDRESS = '';
const TESTNET_CONTRACT_NAME = 'silent-bridge-v2';
const MAINNET_CONTRACT_NAME = 'silent-bridge-mainnet';

const TESTNET_SBTC_ADDRESS = 'ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT';
const MAINNET_SBTC_ADDRESS = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4';
const TESTNET_USDCX_ADDRESS = 'ST802YSF654B96WRF9Z5XHH9SMB5VWHWYM0D422A';
const MAINNET_USDCX_ADDRESS = '';

export const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  (STACKS_NETWORK === 'testnet' ? TESTNET_CONTRACT_ADDRESS : MAINNET_CONTRACT_ADDRESS);

export const CONTRACT_NAME =
  process.env.NEXT_PUBLIC_CONTRACT_NAME ||
  (STACKS_NETWORK === 'testnet' ? TESTNET_CONTRACT_NAME : MAINNET_CONTRACT_NAME);

export const SBTC_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_SBTC_CONTRACT_ADDRESS ||
  (STACKS_NETWORK === 'testnet' ? TESTNET_SBTC_ADDRESS : MAINNET_SBTC_ADDRESS);

export const SBTC_CONTRACT_NAME = process.env.NEXT_PUBLIC_SBTC_CONTRACT_NAME || 'sbtc-token';
export const SBTC_TOKEN_NAME = process.env.NEXT_PUBLIC_SBTC_TOKEN_NAME || 'sbtc-token';

export const SBTC_ASSET_ID =
  `${SBTC_CONTRACT_ADDRESS}.${SBTC_CONTRACT_NAME}::${SBTC_TOKEN_NAME}`;

export const USDCX_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_USDCX_CONTRACT_ADDRESS ||
  (STACKS_NETWORK === 'testnet' ? TESTNET_USDCX_ADDRESS : MAINNET_USDCX_ADDRESS);

export const USDCX_CONTRACT_NAME = process.env.NEXT_PUBLIC_USDCX_CONTRACT_NAME || 'usdcx-token';
export const USDCX_TOKEN_NAME = process.env.NEXT_PUBLIC_USDCX_TOKEN_NAME || 'usdcx-token';

export const USDCX_ASSET_ID =
  `${USDCX_CONTRACT_ADDRESS}.${USDCX_CONTRACT_NAME}::${USDCX_TOKEN_NAME}`;

export const HIRO_API_BASE_URL =
  STACKS_NETWORK === 'testnet'
    ? 'https://api.testnet.hiro.so'
    : 'https://api.mainnet.hiro.so';

export const EXPLORER_CHAIN = STACKS_NETWORK;

export const getConfiguredStacksAddress = (
  profile?: { stxAddress?: Partial<Record<StacksNetworkName, string>> }
) => profile?.stxAddress?.[STACKS_NETWORK] || '';
