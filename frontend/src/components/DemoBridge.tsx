'use client';

import { useEffect, useState } from 'react';
import {
  connect,
  disconnect,
  getSelectedProvider,
  getSelectedProviderId,
  request,
  setSelectedProviderId,
} from '@stacks/connect';
import {
  ClarityValue,
  Pc,
  PostCondition,
  PostConditionMode,
  cvToValue,
  fetchCallReadOnlyFunction,
  fetchContractMapEntry,
  principalCV,
  standardPrincipalCV,
  stringAsciiCV,
  uintCV,
} from '@stacks/transactions';
import { ArrowDownUp, BadgeCent, ExternalLink, Gauge, Search, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react';
import { BridgeTransaction, demoData, Token } from '@/lib/demo-config';
import {
  CONTRACT_ADDRESS,
  CONTRACT_NAME,
  EXPLORER_CHAIN,
  HIRO_API_BASE_URL,
  SBTC_ASSET_ID,
  SBTC_CONTRACT_ADDRESS,
  STACKS_NETWORK,
  USDCX_ASSET_ID,
  USDCX_CONTRACT_ADDRESS,
  network,
} from '@/lib/stacks-config';
import { quoteConfig } from '@/lib/quote-config';

const [sbtcContractId, sbtcTokenName] = SBTC_ASSET_ID.split('::') as [`${string}.${string}`, string];
const [usdcxContractId, usdcxTokenName] = USDCX_ASSET_ID.split('::') as [`${string}.${string}`, string];
const [sbtcContractAddress, sbtcContractName] = sbtcContractId.split('.') as [string, string];
const [usdcxContractAddress, usdcxContractName] = usdcxContractId.split('.') as [string, string];
const CONTRACT_PRINCIPAL = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;
const WALLET_STORAGE_KEY = `silentbtc:${STACKS_NETWORK}:stx-address`;
const PROVIDER_STORAGE_KEY = `silentbtc:${STACKS_NETWORK}:provider-id`;
const PREFERRED_PROVIDER_ID = 'LeatherProvider';

type AssetSymbol = 'STX' | 'sBTC' | 'USDCx';
type RoutingPreference = 'fastest' | 'cheapest';
type SwapRoute = {
  from: AssetSymbol;
  to: AssetSymbol;
  functionName:
    | 'lock-stx-for-sbtc'
    | 'lock-stx-for-usdcx'
    | 'lock-sbtc-for-stx'
    | 'lock-sbtc-for-usdcx'
    | 'lock-usdcx-for-stx'
    | 'lock-usdcx-for-sbtc';
};

const SWAP_ROUTES = {
  'STX-sBTC': { from: 'STX', to: 'sBTC', functionName: 'lock-stx-for-sbtc' },
  'sBTC-STX': { from: 'sBTC', to: 'STX', functionName: 'lock-sbtc-for-stx' },
  'STX-USDCx': { from: 'STX', to: 'USDCx', functionName: 'lock-stx-for-usdcx' },
  'USDCx-STX': { from: 'USDCx', to: 'STX', functionName: 'lock-usdcx-for-stx' },
  'sBTC-USDCx': { from: 'sBTC', to: 'USDCx', functionName: 'lock-sbtc-for-usdcx' },
  'USDCx-sBTC': { from: 'USDCx', to: 'sBTC', functionName: 'lock-usdcx-for-sbtc' },
} as const satisfies Record<string, SwapRoute>;

type SwapMode = keyof typeof SWAP_ROUTES;
const SWAP_ORDER = Object.keys(SWAP_ROUTES) as SwapMode[];

type ActiveTransaction = {
  id: string;
  txId: string;
  amount: string;
  unitAmount: string;
  minOutputAmount?: string;
  fromAsset: AssetSymbol;
  toAsset: AssetSymbol;
  preference: RoutingPreference;
  status: 'Privacy Shielded' | 'Fulfilled' | 'Reclaimed' | 'Syncing';
  timestamp: string;
  outputAmount?: string;
  outputUnitAmount?: string;
  resolutionTxId?: string;
};

type PendingIntentSnapshot = {
  amount: string;
  minOutputAmount?: string;
  fromAsset: AssetSymbol;
  toAsset: AssetSymbol;
  preference: RoutingPreference;
};

type HiroFunctionArg = {
  name?: string;
  repr?: string;
  type?: string;
};

type HiroTransaction = {
  tx_id?: string;
  tx_status?: string;
  sender_address?: string;
  block_height?: number;
  burn_block_time_iso?: string;
  contract_call?: {
    contract_id?: string;
    function_name?: string;
    function_args?: HiroFunctionArg[];
  };
};

type HiroTransactionsResponse = {
  results?: HiroTransaction[];
};

type ParsedLockIntent = {
  amount: string;
  minOutputAmount?: string;
  fromAsset: AssetSymbol;
  toAsset: AssetSymbol;
  preference: RoutingPreference;
  txId: string;
  timestamp: string;
  sortHeight: number;
};

type ParsedResolution = {
  txId: string;
  timestamp: string;
  sortHeight: number;
  type: 'Fulfilled' | 'Reclaimed';
  outputAmount?: string;
};

type ParsedFulfillment = ParsedResolution & {
  type: 'Fulfilled';
  outputAmount: string;
};

const MAINNET_RELEASE_SWAP_ORDER: SwapMode[] = ['STX-sBTC', 'sBTC-STX'];

type AddressBalancesResponse = {
  stx?: {
    balance?: string;
  };
  fungible_tokens?: Record<
    string,
    {
      balance?: string;
    }
  >;
};

type BalanceLine = {
  baseUnits: string;
  display: string;
  symbol: AssetSymbol;
  unitsLabel: string;
};

type QuoteResponse = {
  pair: string;
  preference: RoutingPreference;
  inputAmount: string;
  expectedOutputAmount: string;
  expectedOutputDisplay: string;
  minimumOutputAmount: string;
  minimumOutputDisplay: string;
  solverFeeBps: number;
  slippageBufferBps: number;
  sourceName: string;
  sourceEndpoint: string;
  quotedAt: string;
  expiresAt: string;
  freshnessThresholdSeconds: number;
  fallbackSource: string;
  loggingDestination: string;
};

type WalletBalances = Record<AssetSymbol, BalanceLine>;

type AccountingLine = {
  escrowed: string;
  liquidity: string;
  onChain: string;
  displayEscrowed: string;
  displayLiquidity: string;
  displayOnChain: string;
  symbol: AssetSymbol;
  matches: boolean;
};

type ProtocolAccounting = Record<AssetSymbol, AccountingLine>;

const makeStandardSTXPostCondition = (sender: string, amount: bigint) =>
  Pc.principal(sender).willSendEq(amount).ustx();

const makeStandardFungiblePostCondition = (
  sender: string,
  amount: bigint,
  contractId: `${string}.${string}`,
  tokenName: string
) =>
  Pc.principal(sender).willSendEq(amount).ft(contractId, tokenName);

const parseTokenUnits = (value: string, decimals: number): bigint | null => {
  const trimmed = value.trim();
  if (!/^\d+(\.\d*)?$/.test(trimmed)) return null;

  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > decimals) return null;

  const scale = 10n ** BigInt(decimals);
  const wholeUnits = BigInt(whole || '0') * scale;
  const fractionalUnits = BigInt((fraction || '').padEnd(decimals, '0') || '0');

  return wholeUnits + fractionalUnits;
};

const formatTokenUnits = (baseUnits: string, decimals: number) => {
  const raw = baseUnits.trim();
  if (!/^\d+$/.test(raw)) return baseUnits;

  const amount = BigInt(raw);
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');

  return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
};

const getAssetDecimals = (symbol: AssetSymbol) => getTokenBySymbol(symbol).decimals;

const buildBalanceLine = (symbol: AssetSymbol, baseUnits: string): BalanceLine => ({
  baseUnits,
  display: formatTokenUnits(baseUnits, getAssetDecimals(symbol)),
  symbol,
  unitsLabel: getUnitsLabel(symbol),
});

const getFungibleBalance = (
  balances: AddressBalancesResponse | null,
  assetId: string
) => balances?.fungible_tokens?.[assetId]?.balance || '0';

const buildWalletBalances = (balances: AddressBalancesResponse | null): WalletBalances => ({
  STX: buildBalanceLine('STX', balances?.stx?.balance || '0'),
  sBTC: buildBalanceLine('sBTC', getFungibleBalance(balances, SBTC_ASSET_ID)),
  USDCx: buildBalanceLine('USDCx', getFungibleBalance(balances, USDCX_ASSET_ID)),
});

const buildAccountingLine = (
  symbol: AssetSymbol,
  escrowed: string,
  liquidity: string,
  onChain: string
): AccountingLine => ({
  escrowed,
  liquidity,
  onChain,
  displayEscrowed: formatTokenUnits(escrowed, getAssetDecimals(symbol)),
  displayLiquidity: formatTokenUnits(liquidity, getAssetDecimals(symbol)),
  displayOnChain: formatTokenUnits(onChain, getAssetDecimals(symbol)),
  symbol,
  matches: BigInt(escrowed) + BigInt(liquidity) === BigInt(onChain),
});

const buildEmptyAccounting = (): ProtocolAccounting => ({
  STX: buildAccountingLine('STX', '0', '0', '0'),
  sBTC: buildAccountingLine('sBTC', '0', '0', '0'),
  USDCx: buildAccountingLine('USDCx', '0', '0', '0'),
});

const fetchAddressBalances = async (principal: string) => {
  const response = await fetch(
    `${HIRO_API_BASE_URL}/extended/v1/address/${encodeURIComponent(principal)}/balances`
  );

  if (!response.ok) {
    throw new Error(`Could not load balances for ${principal}.`);
  }

  return response.json() as Promise<AddressBalancesResponse>;
};

const parseUintRepr = (repr?: string) => {
  if (!repr) return null;
  const normalized = repr.trim();
  if (!/^u\d+$/.test(normalized)) return null;
  return normalized.slice(1);
};

const parseStringRepr = (repr?: string) => {
  if (!repr) return null;
  const match = repr.match(/^"(.*)"$/);
  return match ? match[1] : null;
};

const parsePrincipalRepr = (repr?: string) => {
  if (!repr) return null;
  return repr.replace(/^'/, '').trim() || null;
};

const getTxSortHeight = (tx: HiroTransaction) => tx.block_height ?? 0;

const getTxTimestamp = (tx: HiroTransaction) =>
  tx.burn_block_time_iso || new Date(0).toISOString();

const matchesPendingIntent = (lock: ParsedLockIntent, pending: PendingIntentSnapshot | null) =>
  Boolean(
    pending &&
      lock.amount === pending.amount &&
      (pending.minOutputAmount ? lock.minOutputAmount === pending.minOutputAmount : true) &&
      lock.fromAsset === pending.fromAsset &&
      lock.toAsset === pending.toAsset &&
      lock.preference === pending.preference
  );

const getStatusVisuals = (status: ActiveTransaction['status']) => {
  if (status === 'Fulfilled') {
    return {
      labelColor: '#34D399',
      dotColor: '#34D399',
      badgeBg: 'rgba(52, 211, 153, 0.12)',
      badgeBorder: '1px solid rgba(52, 211, 153, 0.25)',
    };
  }

  if (status === 'Reclaimed') {
    return {
      labelColor: '#FBBF24',
      dotColor: '#FBBF24',
      badgeBg: 'rgba(251, 191, 36, 0.12)',
      badgeBorder: '1px solid rgba(251, 191, 36, 0.25)',
    };
  }

  if (status === 'Syncing') {
    return {
      labelColor: '#A1A1AA',
      dotColor: '#A1A1AA',
      badgeBg: 'rgba(161, 161, 170, 0.12)',
      badgeBorder: '1px solid rgba(161, 161, 170, 0.2)',
    };
  }

  return {
    labelColor: '#FEDA15',
    dotColor: '#FEDA15',
    badgeBg: 'rgba(254, 218, 21, 0.12)',
    badgeBorder: '1px solid rgba(254, 218, 21, 0.25)',
  };
};

const toAssetSymbol = (token: Token): AssetSymbol => token.symbol as AssetSymbol;

const getUnitsLabel = (symbol: AssetSymbol) => {
  if (symbol === 'STX') return 'micro-STX';
  if (symbol === 'sBTC') return 'satoshis';
  return 'micro-USDCx';
};

const isAddressForConfiguredNetwork = (address: string) => {
  if (STACKS_NETWORK === 'testnet') return address.startsWith('ST') || address.startsWith('SN');
  return address.startsWith('SP') || address.startsWith('SM');
};

const getTokenBySymbol = (symbol: AssetSymbol) => {
  const token = demoData.tokens.find(item => item.symbol === symbol);
  if (!token) throw new Error(`Missing token config for ${symbol}`);
  return token;
};

const getFungibleAssetInfo = (symbol: Exclude<AssetSymbol, 'STX'>) => {
  if (symbol === 'sBTC') {
    return {
      contractAddress: sbtcContractAddress,
      contractName: sbtcContractName,
      contractId: sbtcContractId,
      tokenName: sbtcTokenName,
      assetId: SBTC_ASSET_ID,
    };
  }

  return {
    contractAddress: usdcxContractAddress,
    contractName: usdcxContractName,
    contractId: usdcxContractId,
    tokenName: usdcxTokenName,
    assetId: USDCX_ASSET_ID,
  };
};

type ContractCallRequest = {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditions: PostCondition[];
  postConditionMode: PostConditionMode;
  stxAddress: string;
  onFinish?: (data: { txId?: string }) => void;
  onCancel?: (error?: Error) => void;
};

const requestContractCall = (options: ContractCallRequest) =>
  new Promise<void>((resolve, reject) => {
    let provider = getSelectedProvider();

    if (!provider && typeof window !== 'undefined') {
      const storedProviderId = localStorage.getItem(PROVIDER_STORAGE_KEY) || PREFERRED_PROVIDER_ID;
      if (storedProviderId) {
        setSelectedProviderId(storedProviderId);
        provider = getSelectedProvider();
      }
    }

    if (!provider) {
      reject(new Error('No wallet provider selected.'));
      return;
    }

    const timeout = window.setTimeout(() => {
      const error = new Error('Wallet request timed out. Leather may be blocked by another wallet extension.');
      options.onCancel?.(error);
      reject(error);
    }, 15000);

    request(
      {
        provider,
        enableLocalStorage: true,
        persistWalletSelect: true,
      },
      'stx_callContract',
      {
        contract: `${options.contractAddress}.${options.contractName}`,
        functionName: options.functionName,
        functionArgs: options.functionArgs,
        network: STACKS_NETWORK,
        postConditions: options.postConditions,
        postConditionMode: options.postConditionMode === PostConditionMode.Allow ? 'allow' : 'deny',
        address: options.stxAddress,
      }
    )
      .then(result => {
        window.clearTimeout(timeout);
        options.onFinish?.({ txId: result.txid });
        resolve();
      })
      .catch(error => {
        window.clearTimeout(timeout);
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        options.onCancel?.(normalizedError);
        reject(normalizedError);
      });
  });

export default function DemoBridge() {
  const isReleaseTrackContract = CONTRACT_NAME === 'silent-bridge-mainnet';
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [swapMode, setSwapMode] = useState<SwapMode>('STX-sBTC');
  const [fromAmount, setFromAmount] = useState('');
  const [minReceived, setMinReceived] = useState('');
  const [routingPreference, setRoutingPreference] = useState<RoutingPreference>('fastest');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [activeTransactions, setActiveTransactions] = useState<ActiveTransaction[]>([]);
  const [syncedTransactions, setSyncedTransactions] = useState<ActiveTransaction[]>([]);
  const [revealedVaultId, setRevealedVaultId] = useState<string | null>(null);
  const [isWalletSignedIn, setIsWalletSignedIn] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [providerId, setProviderId] = useState<string | null>(null);
  const [stacksInfo, setStacksInfo] = useState<{ tip: number } | null>(null);
  const [explorerSyncState, setExplorerSyncState] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [walletBalances, setWalletBalances] = useState<WalletBalances>(() => buildWalletBalances(null));
  const [walletBalanceSyncState, setWalletBalanceSyncState] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [protocolAccounting, setProtocolAccounting] = useState<ProtocolAccounting>(() => buildEmptyAccounting());
  const [protocolSyncState, setProtocolSyncState] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [operatorAction, setOperatorAction] = useState<string | null>(null);
  const [mintAmount, setMintAmount] = useState('');
  const [mintRecipient, setMintRecipient] = useState('');
  const [liquidityAsset, setLiquidityAsset] = useState<AssetSymbol>(
    isReleaseTrackContract ? 'sBTC' : 'USDCx'
  );
  const [liquidityAmount, setLiquidityAmount] = useState('');
  const [fulfillUser, setFulfillUser] = useState('');
  const [fulfillAsset, setFulfillAsset] = useState<AssetSymbol>(
    isReleaseTrackContract ? 'sBTC' : 'USDCx'
  );
  const [fulfillAmount, setFulfillAmount] = useState('');
  const [explorerQuery, setExplorerQuery] = useState('');
  const [explorerStatusFilter, setExplorerStatusFilter] = useState<'all' | ActiveTransaction['status']>('all');
  const [explorerAssetFilter, setExplorerAssetFilter] = useState<'all' | AssetSymbol>('all');
  const [mainnetAcknowledged, setMainnetAcknowledged] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [quoteDetails, setQuoteDetails] = useState<QuoteResponse | null>(null);

  const route = SWAP_ROUTES[swapMode];
  const availableSwapModes = isReleaseTrackContract ? MAINNET_RELEASE_SWAP_ORDER : SWAP_ORDER;
  const visibleAssetSymbols: AssetSymbol[] = isReleaseTrackContract ? ['STX', 'sBTC'] : ['STX', 'sBTC', 'USDCx'];
  const explorerAssetOptions: ('all' | AssetSymbol)[] = ['all', ...visibleAssetSymbols];
  const operatorAssetOptions: AssetSymbol[] = isReleaseTrackContract ? ['STX', 'sBTC'] : ['STX', 'sBTC', 'USDCx'];
  const fromToken = getTokenBySymbol(route.from);
  const toToken = getTokenBySymbol(route.to);
  const fromAsset = toAssetSymbol(fromToken);
  const toAsset = toAssetSymbol(toToken);
  const parsedAmount = parseTokenUnits(fromAmount, fromToken.decimals);
  const parsedMinReceived = parseTokenUnits(minReceived, toToken.decimals);
  const hasValidAmount = parsedAmount !== null && parsedAmount > 0n;
  const requiresQuoteFloor = isReleaseTrackContract;
  const hasValidMinReceived = parsedMinReceived !== null && parsedMinReceived > 0n;
  const routeLabel = `${fromToken.symbol} -> ${toToken.symbol}`;
  const displayAddress = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '';
  const isOperator = STACKS_NETWORK === 'testnet' && walletAddress === CONTRACT_ADDRESS;
  const operatorBusy = Boolean(operatorAction);
  const bridgeContractConfigured =
    Boolean(CONTRACT_ADDRESS) &&
    !CONTRACT_ADDRESS.includes('...') &&
    isAddressForConfiguredNetwork(CONTRACT_ADDRESS);
  const sbtcConfigured =
    Boolean(SBTC_CONTRACT_ADDRESS) &&
    !SBTC_ASSET_ID.includes('...') &&
    isAddressForConfiguredNetwork(SBTC_CONTRACT_ADDRESS);
  const usdcxConfigured =
    Boolean(USDCX_CONTRACT_ADDRESS) &&
    !USDCX_ASSET_ID.includes('...') &&
    isAddressForConfiguredNetwork(USDCX_CONTRACT_ADDRESS);
  const currentRouteConfigured =
    bridgeContractConfigured &&
    (route.from !== 'sBTC' && route.to !== 'sBTC' ? true : sbtcConfigured) &&
    (route.from !== 'USDCx' && route.to !== 'USDCx' ? true : usdcxConfigured);
  const routeAllowedOnNetwork = availableSwapModes.includes(swapMode);
  const mainnetReadinessIssues = [
    !bridgeContractConfigured ? 'Bridge contract address is not configured for mainnet.' : null,
    !sbtcConfigured ? 'sBTC asset principal is not configured for mainnet.' : null,
  ].filter((issue): issue is string => issue !== null);
  const requiresMainnetAcknowledge =
    STACKS_NETWORK === 'mainnet' && isReleaseTrackContract && mainnetReadinessIssues.length === 0;
  const bridgeDisabledForSafety =
    !routeAllowedOnNetwork ||
    (isReleaseTrackContract && !currentRouteConfigured) ||
    (requiresMainnetAcknowledge && !mainnetAcknowledged);

  const resetQuoteState = (clearMinReceived = false) => {
    setQuoteState('idle');
    setQuoteDetails(null);
    if (clearMinReceived) {
      setMinReceived('');
    }
  };

  const refreshWalletState = () => {
    if (typeof window === 'undefined') return;

    const storedAddress = localStorage.getItem(WALLET_STORAGE_KEY) || '';
    const storedProviderId = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (!storedAddress || !isAddressForConfiguredNetwork(storedAddress)) {
      setIsWalletSignedIn(false);
      setWalletAddress('');
      setProviderId(null);
      return;
    }

    setIsWalletSignedIn(true);
    setWalletAddress(storedAddress);
    setProviderId(storedProviderId);
  };

  const connectWallet = async () => {
    try {
      const response = await connect({
        network: STACKS_NETWORK,
        forceWalletSelect: true,
        approvedProviderIds: [PREFERRED_PROVIDER_ID],
        persistWalletSelect: true,
      });
      const selectedAddress = response.addresses.find(
        item => item.symbol?.toLowerCase() === 'stx' && isAddressForConfiguredNetwork(item.address)
      ) || response.addresses.find(item => isAddressForConfiguredNetwork(item.address));

      if (!selectedAddress) {
        throw new Error(`No ${STACKS_NETWORK} STX address returned by wallet.`);
      }

      const selectedProviderId = getSelectedProviderId() || PREFERRED_PROVIDER_ID;
      setSelectedProviderId(selectedProviderId);
      localStorage.setItem(WALLET_STORAGE_KEY, selectedAddress.address);
      if (selectedProviderId) {
        localStorage.setItem(PROVIDER_STORAGE_KEY, selectedProviderId);
      }
      setWalletAddress(selectedAddress.address);
      setIsWalletSignedIn(true);
      setProviderId(selectedProviderId);
      setShowWalletDropdown(false);
    } catch (error) {
      console.error('Wallet connection failed:', error);
      alert('Could not connect Leather/Xverse. Confirm the wallet is unlocked and set to the selected Stacks network.');
    }
  };

  const submitOperatorCall = async ({
    actionLabel,
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    postConditions = [],
    postConditionMode = PostConditionMode.Deny,
  }: {
    actionLabel: string;
    contractAddress: string;
    contractName: string;
    functionName: string;
    functionArgs: ClarityValue[];
    postConditions?: PostCondition[];
    postConditionMode?: PostConditionMode;
  }) => {
    if (!walletAddress) {
      await connectWallet();
      return;
    }

    setOperatorAction(actionLabel);

    try {
      await requestContractCall({
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        postConditions,
        postConditionMode,
        stxAddress: walletAddress,
        onFinish: data => {
          if (!data.txId) {
            alert(`${actionLabel} returned without a transaction ID. Please inspect Leather and retry.`);
            return;
          }

          setSuccessTxHash(data.txId);
          setShowSuccessModal(true);
          setRefreshNonce(current => current + 1);
          setOperatorAction(null);
        },
        onCancel: () => {
          setOperatorAction(null);
        },
      });
    } catch (error) {
      console.error(`${actionLabel} failed:`, error);
      setOperatorAction(null);
      alert(error instanceof Error ? error.message : `${actionLabel} failed.`);
    }
  };

  const handleMintUsdcx = async () => {
    const recipient = mintRecipient.trim() || walletAddress;
    const amount = parseTokenUnits(mintAmount, 6);

    if (!recipient || !isAddressForConfiguredNetwork(recipient)) {
      alert(`Enter a valid ${STACKS_NETWORK} recipient address.`);
      return;
    }

    if (amount === null || amount <= 0n) {
      alert('USDCx mint amount must be greater than zero and use at most 6 decimals.');
      return;
    }

    await submitOperatorCall({
      actionLabel: 'Mint USDCx',
      contractAddress: usdcxContractAddress,
      contractName: usdcxContractName,
      functionName: 'mint',
      functionArgs: [uintCV(amount), principalCV(recipient)],
      postConditions: [],
      postConditionMode: PostConditionMode.Allow,
    });

    setMintAmount('');
  };

  const handleProvideLiquidity = async () => {
    const amount = parseTokenUnits(liquidityAmount, getTokenBySymbol(liquidityAsset).decimals);

    if (amount === null || amount <= 0n) {
      alert(`${liquidityAsset} liquidity amount is invalid.`);
      return;
    }

    if (isReleaseTrackContract && liquidityAsset === 'USDCx') {
      alert('USDCx liquidity is not available on the STX <-> sBTC release track.');
      return;
    }

    if (liquidityAsset === 'STX') {
      await submitOperatorCall({
        actionLabel: 'Provide STX Liquidity',
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'provide-stx-liquidity',
        functionArgs: [uintCV(amount)],
        postConditions: [makeStandardSTXPostCondition(walletAddress, amount)],
      });
      setLiquidityAmount('');
      return;
    }

    const assetInfo = getFungibleAssetInfo(liquidityAsset);
    await submitOperatorCall({
      actionLabel: `Provide ${liquidityAsset} Liquidity`,
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: liquidityAsset === 'sBTC' ? 'provide-sbtc-liquidity' : 'provide-usdcx-liquidity',
      functionArgs: [uintCV(amount)],
      postConditions: [
        makeStandardFungiblePostCondition(walletAddress, amount, assetInfo.contractId, assetInfo.tokenName),
      ],
    });

    setLiquidityAmount('');
  };

  const handleFulfillSwap = async () => {
    const user = fulfillUser.trim();
    const amount = parseTokenUnits(fulfillAmount, getTokenBySymbol(fulfillAsset).decimals);

    if (!user || !isAddressForConfiguredNetwork(user)) {
      alert(`Enter a valid ${STACKS_NETWORK} address for fulfillment.`);
      return;
    }

    if (amount === null || amount <= 0n) {
      alert('Fulfill amount is invalid.');
      return;
    }

    if (isReleaseTrackContract && fulfillAsset === 'USDCx') {
      alert('USDCx fulfillment is not available on the STX <-> sBTC release track.');
      return;
    }

    await submitOperatorCall({
      actionLabel: 'Fulfill Swap',
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'fulfill-swap',
      functionArgs: [principalCV(user), uintCV(amount)],
      postConditions: [],
      postConditionMode: PostConditionMode.Allow,
    });

    setFulfillAmount('');
  };

  const handleReclaimEscrow = async () => {
    await submitOperatorCall({
      actionLabel: 'Reclaim Escrow',
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'reclaim-escrow',
      functionArgs: [],
      postConditions: [],
      postConditionMode: PostConditionMode.Allow,
    });
  };

  const handleGenerateQuote = async () => {
    if (!requiresQuoteFloor) return;

    const amountInBaseUnits = parseTokenUnits(fromAmount, fromToken.decimals);
    if (amountInBaseUnits === null || amountInBaseUnits <= 0n) {
      alert(`Enter a valid ${fromToken.symbol} amount before requesting a quote.`);
      return;
    }

    setQuoteState('loading');

    try {
      const params = new URLSearchParams({
        fromAsset,
        toAsset,
        inputAmount: amountInBaseUnits.toString(),
        preference: routingPreference,
      });

      const response = await fetch(`/api/quote?${params.toString()}`);
      const payload = (await response.json()) as QuoteResponse | { error?: string };

      if (!response.ok || !('minimumOutputDisplay' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Quote request failed.');
      }

      setQuoteDetails(payload);
      setMinReceived(payload.minimumOutputDisplay);
      setQuoteState('ready');
    } catch (error) {
      console.error('Quote request failed:', error);
      setQuoteDetails(null);
      setQuoteState('error');
      alert(error instanceof Error ? error.message : 'Quote request failed.');
    }
  };

  const toggleSwapPair = () => {
    if (isProcessing) return;
    setSwapMode(current => {
      const currentRoute = SWAP_ROUTES[current];
      return availableSwapModes.find(
        mode => SWAP_ROUTES[mode].from === currentRoute.to && SWAP_ROUTES[mode].to === currentRoute.from
      ) || current;
    });
    setMainnetAcknowledged(false);
    setFromAmount('');
    resetQuoteState(true);
  };

  const handleBridge = async () => {
    if (!walletAddress) {
      await connectWallet();
      return;
    }

    if (!routeAllowedOnNetwork) {
      alert(`${routeLabel} is not available on ${STACKS_NETWORK}. Mainnet release scope is STX <-> sBTC only.`);
      return;
    }

    if (!currentRouteConfigured) {
      alert(`The ${routeLabel} route is not fully configured for ${STACKS_NETWORK} yet.`);
      return;
    }

    if (requiresMainnetAcknowledge && !mainnetAcknowledged) {
      alert('Confirm the mainnet safety acknowledgement before submitting a live transaction.');
      return;
    }

    const amountInBaseUnits = parseTokenUnits(fromAmount, fromToken.decimals);
    if (amountInBaseUnits === null || amountInBaseUnits <= 0n) {
      alert(`${fromToken.symbol} amount must be greater than zero and use at most ${fromToken.decimals} decimals.`);
      return;
    }

    const minReceivedInBaseUnits = requiresQuoteFloor ? parseTokenUnits(minReceived, toToken.decimals) : null;
    if (requiresQuoteFloor && (minReceivedInBaseUnits === null || minReceivedInBaseUnits <= 0n)) {
      alert(`${toToken.symbol} minimum received must be greater than zero and use at most ${toToken.decimals} decimals.`);
      return;
    }

    if (CONTRACT_ADDRESS.includes('...')) {
      alert(`Contract address is not configured yet for ${STACKS_NETWORK}.`);
      return;
    }

    const userAddress = walletAddress;
    if (!userAddress) {
      alert(`Stacks ${STACKS_NETWORK} address not found. Please reconnect your wallet.`);
      return;
    }

    if (!getSelectedProvider() && !providerId) {
      alert('Wallet provider is missing. Disconnect and reconnect Leather, then try again.');
      return;
    }

    setIsProcessing(true);

    try {
      const requestedAmount = fromAmount;
      const requestedPreference = routingPreference;

      const functionName = route.functionName;
      const postCondition = route.from === 'STX'
        ? makeStandardSTXPostCondition(userAddress, amountInBaseUnits)
        : (() => {
            const assetInfo = getFungibleAssetInfo(route.from);
            if (assetInfo.assetId.includes('...')) {
          throw new Error(`${route.from} asset is not configured yet for ${STACKS_NETWORK}.`);
            }
            return makeStandardFungiblePostCondition(
              userAddress,
              amountInBaseUnits,
              assetInfo.contractId,
              assetInfo.tokenName
            );
          })();

      await requestContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName,
        functionArgs: requiresQuoteFloor
          ? [
              uintCV(amountInBaseUnits),
              uintCV(minReceivedInBaseUnits!),
              stringAsciiCV(requestedPreference),
            ]
          : [
              uintCV(amountInBaseUnits),
              stringAsciiCV(requestedPreference),
            ],
        postConditions: [postCondition],
        postConditionMode: PostConditionMode.Deny,
        stxAddress: userAddress,
        onFinish: data => {
          if (!data.txId) {
            setIsProcessing(false);
            alert('Wallet returned without a transaction ID. Please check Leather and try again.');
            return;
          }

          const newTransaction: BridgeTransaction = {
            id: data.txId,
            fromToken,
            toToken,
            amount: requestedAmount,
            status: 'pending',
            timestamp: new Date().toISOString(),
            routingPreference: requestedPreference,
            route: routeLabel,
          };
          const shieldedIntent: ActiveTransaction = {
            id: data.txId,
            txId: data.txId,
            amount: requestedAmount,
            unitAmount: amountInBaseUnits.toString(),
            minOutputAmount: minReceivedInBaseUnits?.toString(),
            fromAsset,
            toAsset,
            preference: requestedPreference,
            status: 'Privacy Shielded',
            timestamp: new Date().toISOString(),
          };

          console.log('Transaction Broadcasted:', data.txId, newTransaction);
          setActiveTransactions(currentTransactions => [shieldedIntent, ...currentTransactions]);
          setFromAmount('');
          setMinReceived('');
          setSuccessTxHash(data.txId);
          setShowSuccessModal(true);
          setRefreshNonce(current => current + 1);
          setIsProcessing(false);
        },
        onCancel: () => {
          setIsProcessing(false);
        },
      });
    } catch (error) {
      console.error('Native intent error:', error);
      setIsProcessing(false);
      const message = error instanceof Error ? error.message : 'Intent failed. Please try again.';
      alert(message);
    }
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(refreshWalletState);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch(`${HIRO_API_BASE_URL}/v2/info`);
        const data = await res.json();
        setStacksInfo({ tip: data.stacks_tip_height });
      } catch (error) {
        console.error(`Error fetching Stacks ${STACKS_NETWORK} info:`, error);
      }
    };

    fetchInfo();
    const interval = setInterval(fetchInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!walletAddress || !isAddressForConfiguredNetwork(walletAddress)) {
      return;
    }

    let isCancelled = false;

    const syncWalletBalances = async () => {
      setWalletBalanceSyncState(current => (current === 'idle' ? 'syncing' : current));

      try {
        const balances = await fetchAddressBalances(walletAddress);
        if (isCancelled) return;
        setWalletBalances(buildWalletBalances(balances));
        setWalletBalanceSyncState('idle');
      } catch (error) {
        console.error('Wallet balance sync failed:', error);
        if (!isCancelled) {
          setWalletBalanceSyncState('error');
        }
      }
    };

    void syncWalletBalances();
    const interval = window.setInterval(syncWalletBalances, 20000);

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [walletAddress, refreshNonce]);

  useEffect(() => {
    if (!bridgeContractConfigured) {
      return;
    }

    let isCancelled = false;

    const syncProtocolAccounting = async () => {
      setProtocolSyncState(current => (current === 'idle' ? 'syncing' : current));

      try {
        const [accountingCv, contractBalances] = await Promise.all([
          fetchCallReadOnlyFunction({
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'get-accounting',
            functionArgs: [],
            senderAddress: walletAddress || CONTRACT_ADDRESS,
            network,
          }),
          fetchAddressBalances(CONTRACT_PRINCIPAL),
        ]);

        if (isCancelled) return;

        const accountingValue = cvToValue(accountingCv) as Record<string, { value?: string }>;
        const nextAccounting: ProtocolAccounting = {
          STX: buildAccountingLine(
            'STX',
            accountingValue['escrowed-stx']?.value || '0',
            accountingValue['liquidity-stx']?.value || '0',
            contractBalances.stx?.balance || '0'
          ),
          sBTC: buildAccountingLine(
            'sBTC',
            accountingValue['escrowed-sbtc']?.value || '0',
            accountingValue['liquidity-sbtc']?.value || '0',
            getFungibleBalance(contractBalances, SBTC_ASSET_ID)
          ),
          USDCx: buildAccountingLine(
            'USDCx',
            accountingValue['escrowed-usdcx']?.value || '0',
            accountingValue['liquidity-usdcx']?.value || '0',
            getFungibleBalance(contractBalances, USDCX_ASSET_ID)
          ),
        };

        setProtocolAccounting(nextAccounting);
        setProtocolSyncState('idle');
      } catch (error) {
        console.error('Protocol accounting sync failed:', error);
        if (!isCancelled) {
          setProtocolSyncState('error');
        }
      }
    };

    void syncProtocolAccounting();
    const interval = window.setInterval(syncProtocolAccounting, 20000);

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [walletAddress, refreshNonce, bridgeContractConfigured]);

  useEffect(() => {
    if (!walletAddress || !isAddressForConfiguredNetwork(walletAddress)) {
      return;
    }

    let isCancelled = false;

    const fetchAddressTransactions = async (principal: string) => {
      const response = await fetch(
        `${HIRO_API_BASE_URL}/extended/v1/address/${encodeURIComponent(principal)}/transactions?limit=50`
      );

      if (!response.ok) {
        throw new Error(`Could not load explorer history for ${principal}.`);
      }

      return response.json() as Promise<HiroTransactionsResponse>;
    };

    const parsePendingIntent = async () => {
      try {
        const clarityValue = await fetchContractMapEntry({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          mapName: 'swap-intents',
          mapKey: standardPrincipalCV(walletAddress),
          network,
        });
        const raw = cvToValue(clarityValue) as
          | null
          | {
              amount?: { value?: string };
              'input-amount'?: { value?: string };
              'min-output-amount'?: { value?: string };
              'from-asset'?: { value?: string };
              'to-asset'?: { value?: string };
              preference?: { value?: string };
            };

        if (!raw) {
          return null;
        }

        return {
          amount: raw['input-amount']?.value || raw.amount?.value || '0',
          minOutputAmount: raw['min-output-amount']?.value || undefined,
          fromAsset: (raw['from-asset']?.value || 'STX') as AssetSymbol,
          toAsset: (raw['to-asset']?.value || 'sBTC') as AssetSymbol,
          preference: (raw.preference?.value || 'fastest') as RoutingPreference,
        } satisfies PendingIntentSnapshot;
      } catch (error) {
        console.error('Failed to read pending swap intent:', error);
        return null;
      }
    };

    const syncExplorer = async () => {
      setExplorerSyncState(current => (current === 'idle' ? 'syncing' : current));

      try {
        const [pendingIntent, userTxResponse, contractTxResult] = await Promise.all([
          parsePendingIntent(),
          fetchAddressTransactions(walletAddress),
          fetchAddressTransactions(CONTRACT_PRINCIPAL).catch(error => {
            console.error('Contract history sync fell back to user-only mode:', error);
            return { results: [] } satisfies HiroTransactionsResponse;
          }),
        ]);

        if (isCancelled) return;

        const userTransactions = userTxResponse.results || [];
        const contractTransactions = contractTxResult.results || [];

        const mappedLockTransactions = userTransactions
          .filter(tx =>
            tx.tx_status === 'success' &&
            tx.contract_call?.contract_id === CONTRACT_PRINCIPAL &&
            typeof tx.contract_call.function_name === 'string' &&
            tx.contract_call.function_name.startsWith('lock-')
          )
          .map<ParsedLockIntent | null>(tx => {
            const functionName = tx.contract_call?.function_name as SwapRoute['functionName'];
            const routeForTx = Object.values(SWAP_ROUTES).find(routeCandidate => routeCandidate.functionName === functionName);
            const amount = parseUintRepr(tx.contract_call?.function_args?.[0]?.repr);
            const maybeMinOutput = parseUintRepr(tx.contract_call?.function_args?.[1]?.repr) || undefined;
            const preferenceArg = tx.contract_call?.function_args?.[tx.contract_call.function_args.length - 1]?.repr;
            const preference = parseStringRepr(preferenceArg) as RoutingPreference | null;

            if (!routeForTx || !amount || !preference || !tx.tx_id) return null;

            return {
              amount,
              minOutputAmount: maybeMinOutput,
              fromAsset: routeForTx.from,
              toAsset: routeForTx.to,
              preference,
              txId: tx.tx_id,
              timestamp: getTxTimestamp(tx),
              sortHeight: getTxSortHeight(tx),
            } satisfies ParsedLockIntent;
          });

        const lockTransactions: ParsedLockIntent[] = mappedLockTransactions
          .filter((tx): tx is ParsedLockIntent => tx !== null)
          .sort((left, right) => right.sortHeight - left.sortHeight);

        const reclaimTransactions: ParsedResolution[] = userTransactions
          .filter(tx =>
            tx.tx_status === 'success' &&
            tx.contract_call?.contract_id === CONTRACT_PRINCIPAL &&
            tx.contract_call?.function_name === 'reclaim-escrow' &&
            Boolean(tx.tx_id)
          )
          .map(tx => ({
            txId: tx.tx_id!,
            timestamp: getTxTimestamp(tx),
            sortHeight: getTxSortHeight(tx),
            type: 'Reclaimed' as const,
          }))
          .sort((left, right) => right.sortHeight - left.sortHeight);

        const fulfillTransactions = contractTransactions
          .filter(tx =>
            tx.tx_status === 'success' &&
            tx.contract_call?.contract_id === CONTRACT_PRINCIPAL &&
            tx.contract_call?.function_name === 'fulfill-swap' &&
            Boolean(tx.tx_id)
          )
          .map(tx => {
            const principal = parsePrincipalRepr(tx.contract_call?.function_args?.[0]?.repr);
            const outputAmount = parseUintRepr(tx.contract_call?.function_args?.[1]?.repr);

            if (principal !== walletAddress || !outputAmount) return null;

            return {
              txId: tx.tx_id!,
              timestamp: getTxTimestamp(tx),
              sortHeight: getTxSortHeight(tx),
              type: 'Fulfilled' as const,
              outputAmount,
            } satisfies ParsedFulfillment;
          })
          .filter((tx): tx is ParsedFulfillment => tx !== null)
          .sort((left, right) => right.sortHeight - left.sortHeight);

        const latestPendingLock = pendingIntent
          ? lockTransactions.find(lock => {
              const earliestResolution = [...reclaimTransactions, ...fulfillTransactions]
                .filter(resolution => resolution.sortHeight > lock.sortHeight)
                .sort((left, right) => left.sortHeight - right.sortHeight)[0];

              return !earliestResolution && matchesPendingIntent(lock, pendingIntent);
            }) || null
          : null;

        const chainTransactions: ActiveTransaction[] = lockTransactions.map(lock => {
          const resolution = [...reclaimTransactions, ...fulfillTransactions]
            .filter(candidate => candidate.sortHeight > lock.sortHeight)
            .sort((left, right) => left.sortHeight - right.sortHeight)[0];

          const fromTokenForLock = getTokenBySymbol(lock.fromAsset);
          const toTokenForLock = getTokenBySymbol(lock.toAsset);
          const status = latestPendingLock?.txId === lock.txId
            ? 'Privacy Shielded'
            : resolution?.type || 'Syncing';

          return {
            id: lock.txId,
            txId: lock.txId,
            amount: formatTokenUnits(lock.amount, fromTokenForLock.decimals),
            unitAmount: lock.amount,
            minOutputAmount: lock.minOutputAmount,
            fromAsset: lock.fromAsset,
            toAsset: lock.toAsset,
            preference: lock.preference,
            status,
            timestamp: lock.timestamp,
            outputAmount: resolution?.outputAmount
              ? formatTokenUnits(resolution.outputAmount, toTokenForLock.decimals)
              : undefined,
            outputUnitAmount: resolution?.outputAmount,
            resolutionTxId: resolution?.txId,
          } satisfies ActiveTransaction;
        });

        if (pendingIntent && !latestPendingLock) {
          const pendingFromToken = getTokenBySymbol(pendingIntent.fromAsset);
          chainTransactions.unshift({
            id: `pending-${walletAddress}`,
            txId: `pending-${walletAddress}`,
            amount: formatTokenUnits(pendingIntent.amount, pendingFromToken.decimals),
            unitAmount: pendingIntent.amount,
            minOutputAmount: pendingIntent.minOutputAmount,
            fromAsset: pendingIntent.fromAsset,
            toAsset: pendingIntent.toAsset,
            preference: pendingIntent.preference,
            status: 'Privacy Shielded',
            timestamp: new Date().toISOString(),
          });
        }

        setSyncedTransactions(chainTransactions);
        setExplorerSyncState('idle');
      } catch (error) {
        console.error('Explorer sync failed:', error);
        if (!isCancelled) {
          setExplorerSyncState('error');
        }
      }
    };

    void syncExplorer();
    const interval = window.setInterval(syncExplorer, 20000);

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [walletAddress, refreshNonce]);

  const explorerTransactions: ActiveTransaction[] = (() => {
    if (!walletAddress || !isAddressForConfiguredNetwork(walletAddress)) {
      if (isReleaseTrackContract) {
        return [];
      }

      return demoData.transactions.map(tx => ({
        id: tx.id,
        txId: tx.id,
        amount: tx.amount,
        unitAmount: parseTokenUnits(tx.amount, tx.fromToken.decimals)?.toString() || '0',
        fromAsset: toAssetSymbol(tx.fromToken),
        toAsset: toAssetSymbol(tx.toToken),
        preference: tx.routingPreference || 'fastest',
        status: 'Privacy Shielded' as const,
        timestamp: tx.timestamp,
      }));
    }

    const mergedTransactions = new Map<string, ActiveTransaction>();

    syncedTransactions.forEach(tx => {
      mergedTransactions.set(tx.txId, tx);
    });

    activeTransactions.forEach(tx => {
      if (!mergedTransactions.has(tx.txId)) {
        mergedTransactions.set(tx.txId, tx);
      }
    });

    const resolvedTransactions = [...mergedTransactions.values()].sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    );

    if (resolvedTransactions.length > 0) {
      return resolvedTransactions;
    }

    if (isReleaseTrackContract) {
      return [];
    }

    return demoData.transactions.map(tx => ({
      id: tx.id,
      txId: tx.id,
      amount: tx.amount,
      unitAmount: parseTokenUnits(tx.amount, tx.fromToken.decimals)?.toString() || '0',
      fromAsset: toAssetSymbol(tx.fromToken),
      toAsset: toAssetSymbol(tx.toToken),
      preference: tx.routingPreference || 'fastest',
      status: 'Privacy Shielded',
      timestamp: tx.timestamp,
    }));
  })();

  const filteredExplorerTransactions = explorerTransactions.filter(tx => {
    if (explorerStatusFilter !== 'all' && tx.status !== explorerStatusFilter) {
      return false;
    }

    if (
      explorerAssetFilter !== 'all' &&
      tx.fromAsset !== explorerAssetFilter &&
      tx.toAsset !== explorerAssetFilter
    ) {
      return false;
    }

    const query = explorerQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const haystack = [
      tx.amount,
      tx.unitAmount,
      tx.fromAsset,
      tx.toAsset,
      tx.preference,
      tx.status,
      tx.txId,
      tx.minOutputAmount || '',
      tx.outputAmount || '',
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });

  const visibleWalletBalances = isWalletSignedIn ? walletBalances : buildWalletBalances(null);
  const visibleWalletBalanceSyncState = isWalletSignedIn ? walletBalanceSyncState : 'idle';
  const visibleProtocolAccounting = bridgeContractConfigured ? protocolAccounting : buildEmptyAccounting();
  const visibleProtocolSyncState = bridgeContractConfigured ? protocolSyncState : 'idle';
  const visibleAccountingMismatchCount = Object.values(visibleProtocolAccounting).filter(line => !line.matches).length;

  const renderShieldedCard = (tx: ActiveTransaction) => {
    const isRevealed = revealedVaultId === tx.id;
    const PreferenceIcon = tx.preference === 'fastest' ? Gauge : BadgeCent;
    const hasExplorerTxId = /^(0x)?[a-f0-9]{64}$/i.test(tx.txId);
    const txId = hasExplorerTxId && !tx.txId.startsWith('0x') ? `0x${tx.txId}` : tx.txId;
    const explorerHref = hasExplorerTxId
      ? `https://explorer.hiro.so/txid/${txId}?chain=${EXPLORER_CHAIN}`
      : null;
    const resolutionHref = tx.resolutionTxId
      ? `https://explorer.hiro.so/txid/${tx.resolutionTxId.startsWith('0x') ? tx.resolutionTxId : `0x${tx.resolutionTxId}`}?chain=${EXPLORER_CHAIN}`
      : null;
    const statusVisuals = getStatusVisuals(tx.status);

    return (
      <div
        key={tx.id}
        onMouseEnter={() => setRevealedVaultId(tx.id)}
        onMouseLeave={() => setRevealedVaultId(current => current === tx.id ? null : current)}
        onClick={() => setRevealedVaultId(current => current === tx.id ? null : tx.id)}
        style={{
          padding: '1.25rem',
          background: 'linear-gradient(145deg, rgba(8, 8, 8, 0.96), rgba(28, 28, 28, 0.92))',
          borderRadius: '16px',
          border: '1px solid rgba(254, 218, 21, 0.22)',
          boxShadow: '0 18px 40px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
          color: '#FFFFFF',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
          minHeight: '190px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            color: statusVisuals.labelColor,
            fontSize: '0.68rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {tx.status}
          </span>
          <span className={tx.status === 'Privacy Shielded' ? 'shield-pulse' : undefined} style={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: statusVisuals.dotColor,
            display: 'inline-block',
          }} />
        </div>

        <div>
          <div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1, letterSpacing: '0' }}>
            {tx.amount}
          </div>
          <div style={{ color: '#FEDA15', fontSize: '0.8rem', fontWeight: 800, marginTop: '0.35rem' }}>
            {tx.fromAsset} escrowed for {tx.toAsset}
          </div>
          <div style={{ color: '#8E8E93', fontSize: '0.68rem', fontWeight: 700, marginTop: '0.25rem' }}>
            Base units: {tx.unitAmount}
          </div>
          {tx.minOutputAmount && (
            <div style={{ color: '#A1A1AA', fontSize: '0.72rem', fontWeight: 700, marginTop: '0.35rem' }}>
              Minimum receive: {formatTokenUnits(tx.minOutputAmount, getAssetDecimals(tx.toAsset))} {tx.toAsset}
            </div>
          )}
          {tx.outputAmount && (
            <div style={{ color: '#E4E4E7', fontSize: '0.72rem', fontWeight: 700, marginTop: '0.45rem' }}>
              Solver output: {tx.outputAmount} {tx.toAsset}
            </div>
          )}
        </div>

        <div>
          <div style={{ color: '#8E8E93', fontSize: '0.68rem', fontWeight: 700, marginBottom: '0.35rem', textTransform: 'uppercase' }}>
            Vault Commitment
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            color: isRevealed ? '#FFFFFF' : '#A1A1AA',
            fontFamily: 'monospace',
            fontSize: '0.72rem',
            lineHeight: 1.5,
            padding: '0.65rem',
            wordBreak: 'break-all',
          }}>
            {isRevealed ? tx.txId : `${tx.txId.slice(0, 12)}...`}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', gap: '0.75rem' }}>
          <span style={{
            alignItems: 'center',
            background: statusVisuals.badgeBg,
            border: statusVisuals.badgeBorder,
            borderRadius: '7px',
            color: tx.status === 'Privacy Shielded' ? '#000000' : statusVisuals.labelColor,
            display: 'inline-flex',
            fontSize: '0.66rem',
            fontWeight: 900,
            gap: '0.32rem',
            padding: '0.4rem 0.55rem',
            textTransform: 'uppercase',
          }}>
            <PreferenceIcon size={13} strokeWidth={2.6} />
            {tx.preference}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {resolutionHref && (
              <a
                href={resolutionHref}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                style={{
                  alignItems: 'center',
                  color: '#A1A1AA',
                  display: 'inline-flex',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  gap: '0.24rem',
                  textDecoration: 'none',
                }}
              >
                Resolution
                <ExternalLink size={12} strokeWidth={2.2} />
              </a>
            )}
            {explorerHref && (
              <a
                href={explorerHref}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                style={{
                  alignItems: 'center',
                  color: '#FEDA15',
                  display: 'inline-flex',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  gap: '0.28rem',
                  textDecoration: 'none',
                }}
              >
                View on Explorer
                <ExternalLink size={13} strokeWidth={2.4} />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      maxWidth: '480px',
      margin: '0 auto',
      padding: '2rem 1rem',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        width: '100%',
      }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A1A1A', letterSpacing: '0' }}>
          silentBTC
        </h1>

        <div style={{ marginLeft: 'auto' }}>
          {isWalletSignedIn ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                style={{
                  background: '#FEDA15',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '0.5rem 1.25rem',
                  color: '#000000',
                  fontSize: '0.875rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s',
                }}
              >
                <span>{displayAddress}</span>
                <span>▼</span>
              </button>
              {showWalletDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '12px',
                  padding: '0.5rem',
                  minWidth: '200px',
                  zIndex: 1000,
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
                }}>
                  <div style={{
                    padding: '0.75rem',
                    fontSize: '0.75rem',
                    color: '#71717A',
                    borderBottom: '1px solid #E4E4E7',
                    marginBottom: '0.5rem',
                    wordBreak: 'break-all',
                  }}>
                    {walletAddress}
                  </div>
                  <button
                    onClick={() => {
                      disconnect();
                      localStorage.removeItem(WALLET_STORAGE_KEY);
                      localStorage.removeItem(PROVIDER_STORAGE_KEY);
                      setIsWalletSignedIn(false);
                      setWalletAddress('');
                      setProviderId(null);
                      setShowWalletDropdown(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#ef4444',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={connectWallet}
              style={{
                background: '#FEDA15',
                border: 'none',
                borderRadius: '9999px',
                padding: '0.5rem 1.25rem',
                color: '#000000',
                fontSize: '0.875rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              }}
            >
              Connect Stacks
            </button>
          )}
        </div>
      </div>

      <div style={{
        background: '#FFFFFF',
        borderRadius: '32px',
        padding: '2.5rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(161, 161, 170, 0.1)',
        maxWidth: '100%',
        width: '100%',
      }}>
        <div style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          gap: '1rem',
        }}>
          <div style={{
            alignItems: 'center',
            color: '#059669',
            display: 'flex',
            fontSize: '0.72rem',
            fontWeight: 900,
            gap: '0.45rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            <span style={{
              background: '#10B981',
              borderRadius: '50%',
              boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.12)',
              display: 'inline-block',
              height: '8px',
              width: '8px',
            }} />
            Stacks {STACKS_NETWORK}
          </div>
          <div style={{ color: '#71717A', fontSize: '0.72rem', fontWeight: 800 }}>
            Tip {stacksInfo ? stacksInfo.tip.toLocaleString() : 'syncing'}
          </div>
        </div>

        <div style={{
          background: '#F7F8FA',
          border: '1px solid #E4E4E7',
          borderRadius: '14px',
          display: 'flex',
          justifyContent: 'center',
          padding: '0.5rem',
          marginBottom: '1rem',
        }}>
          <select
            value={swapMode}
            onChange={e => {
              setSwapMode(e.target.value as SwapMode);
              setMainnetAcknowledged(false);
              setFromAmount('');
              resetQuoteState(true);
            }}
            disabled={isProcessing}
            style={{
              background: '#FEDA15',
              border: 'none',
              borderRadius: '10px',
              color: '#000000',
              fontSize: '0.85rem',
              fontWeight: 900,
              padding: '0.75rem',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              width: '100%',
              textAlign: 'center',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none'
            }}
          >
            {availableSwapModes.map(mode => {
              const optionRoute = SWAP_ROUTES[mode];
              return (
                <option key={mode} value={mode}>
                  {optionRoute.from} -{'>'} {optionRoute.to}
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            background: '#FAFAFA',
            borderBottom: '1px solid #F4F4F5',
            padding: '1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#71717A', fontWeight: 600 }}>From</span>
              <span style={{ fontSize: '0.75rem', color: '#71717A' }}>
                Units: {getUnitsLabel(fromAsset)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => {
                  setFromAmount(e.target.value);
                  if (requiresQuoteFloor && quoteDetails) {
                    resetQuoteState(true);
                  }
                }}
                placeholder="0.0"
                disabled={isProcessing}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  fontFamily: 'Inter, sans-serif',
                  color: '#1A1A1A',
                  width: '100%',
                  outline: 'none',
                  opacity: isProcessing ? 0.5 : 1,
                  letterSpacing: '0',
                }}
              />
              <button
                onClick={toggleSwapPair}
                disabled={isProcessing}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '12px',
                  padding: '0.55rem 0.85rem',
                  color: '#1A1A1A',
                  fontSize: '1rem',
                  fontWeight: 900,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  minWidth: '78px',
                }}
              >
                {fromToken.symbol}
              </button>
            </div>
            {fromAmount && parsedAmount !== null && (
              <div style={{ fontSize: '0.72rem', color: '#71717A', marginTop: '0.5rem', fontWeight: 600 }}>
                Escrow amount: {parsedAmount.toString()} {getUnitsLabel(fromAsset)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0', position: 'relative' }}>
            <button
              onClick={toggleSwapPair}
              disabled={isProcessing}
              id="swap-btn"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E4E4E7',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                color: '#1A1A1A',
                opacity: isProcessing ? 0.5 : 1,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              <ArrowDownUp size={18} strokeWidth={2.4} />
            </button>
          </div>

          <div style={{
            background: '#FAFAFA',
            padding: '1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#71717A', fontWeight: 600 }}>To</span>
              <span style={{ fontSize: '0.75rem', color: '#71717A' }}>Intent output</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <input
                type="text"
                value="Matched by solver"
                readOnly
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.55rem',
                  fontWeight: 900,
                  fontFamily: 'Inter, sans-serif',
                  color: '#A1A1AA',
                  width: '100%',
                  outline: 'none',
                  letterSpacing: '0',
                }}
              />
              <button
                onClick={toggleSwapPair}
                disabled={isProcessing}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E4E4E7',
                  borderRadius: '12px',
                  padding: '0.55rem 0.85rem',
                  color: '#1A1A1A',
                  fontSize: '1rem',
                  fontWeight: 900,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  minWidth: '78px',
                }}
              >
                {toToken.symbol}
              </button>
            </div>
          </div>
        </div>

        {requiresQuoteFloor && (
          <div style={{
            background: '#F7F8FA',
            borderRadius: '12px',
            padding: '1rem',
            marginTop: '1rem',
            marginBottom: '1rem',
            border: '1px solid #E4E4E7',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#71717A', fontWeight: 600 }}>Minimum received</span>
              <span style={{ fontSize: '0.75rem', color: '#71717A' }}>
                Units: {getUnitsLabel(toAsset)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <button
                onClick={handleGenerateQuote}
                disabled={isProcessing || !hasValidAmount || quoteState === 'loading'}
                style={{
                  background: isProcessing || !hasValidAmount || quoteState === 'loading' ? '#F4F4F5' : '#FEDA15',
                  border: 'none',
                  borderRadius: '10px',
                  color: isProcessing || !hasValidAmount || quoteState === 'loading' ? '#71717A' : '#000000',
                  cursor: isProcessing || !hasValidAmount || quoteState === 'loading' ? 'not-allowed' : 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 900,
                  padding: '0.7rem 0.85rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {quoteState === 'loading' ? 'Quoting...' : 'Generate floor'}
              </button>
              <div style={{
                alignItems: 'center',
                background: '#FFFFFF',
                border: '1px solid #E4E4E7',
                borderRadius: '10px',
                color: '#71717A',
                display: 'flex',
                flex: 1,
                fontSize: '0.72rem',
                fontWeight: 700,
                minHeight: '42px',
                padding: '0.6rem 0.8rem',
              }}>
                {quoteDetails
                  ? `${quoteDetails.sourceName} · fee ${quoteDetails.solverFeeBps}bps · slip ${quoteDetails.slippageBufferBps}bps`
                  : `Quote source: ${quoteConfig.sourceName}`}
              </div>
            </div>
            <input
              type="number"
              value={minReceived}
              onChange={event => setMinReceived(event.target.value)}
              placeholder={`0.0 ${toToken.symbol}`}
              disabled={isProcessing}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E4E4E7',
                borderRadius: '10px',
                color: '#1A1A1A',
                fontSize: '0.95rem',
                fontWeight: 800,
                outline: 'none',
                padding: '0.85rem 0.95rem',
                width: '100%',
              }}
            />
            {quoteDetails && (
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E4E4E7',
                borderRadius: '10px',
                marginTop: '0.65rem',
                padding: '0.75rem 0.85rem',
              }}>
                <div style={{ color: '#111827', fontSize: '0.78rem', fontWeight: 800 }}>
                  Expected output: {quoteDetails.expectedOutputDisplay} {toToken.symbol}
                </div>
                <div style={{ color: '#71717A', fontSize: '0.7rem', fontWeight: 700, marginTop: '0.3rem' }}>
                  Quoted {new Date(quoteDetails.quotedAt).toLocaleTimeString()} · expires {new Date(quoteDetails.expiresAt).toLocaleTimeString()}
                </div>
              </div>
            )}
            <div style={{ color: '#71717A', fontSize: '0.72rem', fontWeight: 700, marginTop: '0.55rem' }}>
              Mainnet fulfillments must meet or exceed this floor before the solver can clear your intent.
            </div>
          </div>
        )}

        <div style={{
          background: '#F7F8FA',
          borderRadius: '12px',
          padding: '1rem',
          marginTop: '1rem',
          marginBottom: '1rem',
          border: '1px solid #E4E4E7',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#71717A', marginBottom: '0.75rem', fontWeight: 600 }}>
            Silent Intent Preference
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                setRoutingPreference('fastest');
                if (requiresQuoteFloor && quoteDetails) {
                  resetQuoteState(true);
                }
              }}
              disabled={isProcessing}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '8px',
                border: routingPreference === 'fastest' ? '2px solid #000000' : '1px solid #E4E4E7',
                background: routingPreference === 'fastest' ? '#FEDA15' : '#F7F8FA',
                color: routingPreference === 'fastest' ? '#000000' : '#71717A',
                fontSize: '0.875rem',
                fontWeight: 900,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
              }}
            >
              Fastest
            </button>
            <button
              onClick={() => {
                setRoutingPreference('cheapest');
                if (requiresQuoteFloor && quoteDetails) {
                  resetQuoteState(true);
                }
              }}
              disabled={isProcessing}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '8px',
                border: routingPreference === 'cheapest' ? '2px solid #000000' : '1px solid #E4E4E7',
                background: routingPreference === 'cheapest' ? '#FEDA15' : '#F7F8FA',
                color: routingPreference === 'cheapest' ? '#000000' : '#71717A',
                fontSize: '0.875rem',
                fontWeight: 900,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
              }}
            >
              Cheapest
            </button>
          </div>
        </div>

        <button
          onClick={handleBridge}
          disabled={
            isProcessing ||
            bridgeDisabledForSafety ||
            (isWalletSignedIn && (!hasValidAmount || (requiresQuoteFloor && !hasValidMinReceived)))
          }
          style={{
            width: '100%',
            padding: '1.25rem',
            borderRadius: '16px',
            border: 'none',
            background:
              isProcessing ||
              bridgeDisabledForSafety ||
              (isWalletSignedIn && (!hasValidAmount || (requiresQuoteFloor && !hasValidMinReceived)))
                ? '#F4F4F5'
                : '#FEDA15',
            color:
              isProcessing ||
              bridgeDisabledForSafety ||
              (isWalletSignedIn && (!hasValidAmount || (requiresQuoteFloor && !hasValidMinReceived)))
                ? '#71717A'
                : '#000000',
            fontSize: '1.1rem',
            fontWeight: 900,
            cursor:
              isProcessing ||
              bridgeDisabledForSafety ||
              (isWalletSignedIn && (!hasValidAmount || (requiresQuoteFloor && !hasValidMinReceived)))
                ? 'not-allowed'
                : 'pointer',
            boxShadow:
              isProcessing ||
              bridgeDisabledForSafety ||
              (isWalletSignedIn && (!hasValidAmount || (requiresQuoteFloor && !hasValidMinReceived)))
              ? 'none'
              : '0 0 0 1px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(254, 218, 21, 0.3)',
          }}
        >
          {isProcessing
            ? 'Processing...'
            : !isWalletSignedIn
            ? 'Connect Stacks'
            : bridgeDisabledForSafety
            ? STACKS_NETWORK === 'mainnet'
              ? 'Resolve Mainnet Safety Checks'
              : `Route Not Ready on ${STACKS_NETWORK}`
            : hasValidAmount
            ? requiresQuoteFloor && !hasValidMinReceived
              ? `Set ${toToken.symbol} Floor`
              : `Signal ${routeLabel} Intent`
            : requiresQuoteFloor
            ? `Enter ${fromToken.symbol} Amount + ${toToken.symbol} Floor`
            : `Enter ${fromToken.symbol} Amount`}
        </button>

        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#FAFAFA',
          border: '1px solid #F4F4F5',
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: '#71717A',
          textAlign: 'center',
        }}>
          {STACKS_NETWORK} mode: exact {fromToken.symbol} debit protected by strict post-conditions
        </div>
      </div>

      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '1.5rem',
        marginTop: '1.5rem',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(161, 161, 170, 0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{
              alignItems: 'center',
              color: '#0F766E',
              display: 'flex',
              fontSize: '0.72rem',
              fontWeight: 900,
              gap: '0.45rem',
              letterSpacing: '0.04em',
              marginBottom: '0.35rem',
              textTransform: 'uppercase',
            }}>
              <Wallet size={14} strokeWidth={2.4} />
              Wallet Snapshot
            </div>
            <h3 style={{ color: '#1A1A1A', fontSize: '1.25rem', fontWeight: 900, lineHeight: 1.1 }}>
              Balances on {STACKS_NETWORK}
            </h3>
          </div>
          <div style={{ color: '#71717A', fontSize: '0.72rem', fontWeight: 800, textAlign: 'right' }}>
            {visibleWalletBalanceSyncState === 'syncing'
              ? 'Syncing balances'
              : visibleWalletBalanceSyncState === 'error'
              ? 'Balance sync paused'
              : 'Live Hiro balances'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem' }}>
          {visibleAssetSymbols.map(symbol => {
            const balance = visibleWalletBalances[symbol];

            return (
              <div
                key={symbol}
                style={{
                  background: '#F7F8FA',
                  border: '1px solid #E4E4E7',
                  borderRadius: '16px',
                  padding: '1rem',
                  minHeight: '118px',
                }}
              >
                <div style={{ color: '#71717A', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>
                  {symbol}
                </div>
                <div style={{ color: '#1A1A1A', fontSize: '1.6rem', fontWeight: 900, marginTop: '0.55rem', lineHeight: 1 }}>
                  {balance.display}
                </div>
                <div style={{ color: '#71717A', fontSize: '0.7rem', fontWeight: 700, marginTop: '0.4rem' }}>
                  Base units: {balance.baseUnits}
                </div>
              </div>
            );
          })}
        </div>

        {!isWalletSignedIn && (
          <div style={{ color: '#71717A', fontSize: '0.76rem', fontWeight: 700, marginTop: '0.9rem' }}>
            Connect a wallet to load your live {visibleAssetSymbols.join(', ')} balances.
          </div>
        )}
      </div>

      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '1.5rem',
        marginTop: '1.5rem',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(161, 161, 170, 0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{
              alignItems: 'center',
              color: '#854D0E',
              display: 'flex',
              fontSize: '0.72rem',
              fontWeight: 900,
              gap: '0.45rem',
              letterSpacing: '0.04em',
              marginBottom: '0.35rem',
              textTransform: 'uppercase',
            }}>
              <ShieldCheck size={14} strokeWidth={2.4} />
              Protocol Accounting
            </div>
            <h3 style={{ color: '#1A1A1A', fontSize: '1.25rem', fontWeight: 900, lineHeight: 1.1 }}>
              Escrow, liquidity, and on-chain holdings
            </h3>
          </div>
          <div style={{ color: visibleAccountingMismatchCount === 0 ? '#059669' : '#B45309', fontSize: '0.72rem', fontWeight: 900, textAlign: 'right' }}>
            {visibleProtocolSyncState === 'syncing'
              ? 'Reconciling contract balances'
              : visibleProtocolSyncState === 'error'
              ? 'Accounting sync paused'
              : visibleAccountingMismatchCount === 0
              ? 'Accounting reconciled'
              : `${visibleAccountingMismatchCount} asset bucket${visibleAccountingMismatchCount === 1 ? '' : 's'} need review`}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {visibleAssetSymbols.map(symbol => {
            const line = visibleProtocolAccounting[symbol];

            return (
              <div
                key={symbol}
                style={{
                  background: '#F7F8FA',
                  border: line.matches ? '1px solid #E4E4E7' : '1px solid rgba(234, 179, 8, 0.35)',
                  borderRadius: '16px',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ color: '#1A1A1A', fontSize: '0.95rem', fontWeight: 900 }}>
                    {symbol}
                  </div>
                  <div style={{
                    background: line.matches ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                    borderRadius: '999px',
                    color: line.matches ? '#059669' : '#B45309',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                    padding: '0.25rem 0.55rem',
                    textTransform: 'uppercase',
                  }}>
                    {line.matches ? 'Matched' : 'Review'}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: '0.75rem' }}>
                  {[
                    ['Escrowed', line.displayEscrowed, line.escrowed],
                    ['Liquidity', line.displayLiquidity, line.liquidity],
                    ['On-chain', line.displayOnChain, line.onChain],
                  ].map(([label, displayValue, rawValue]) => (
                    <div key={label} style={{ minWidth: 0 }}>
                      <div style={{ color: '#71717A', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase' }}>
                        {label}
                      </div>
                      <div style={{ color: '#1A1A1A', fontSize: '1rem', fontWeight: 900, marginTop: '0.35rem', lineHeight: 1.1 }}>
                        {displayValue}
                      </div>
                      <div style={{ color: '#71717A', fontSize: '0.68rem', fontWeight: 700, marginTop: '0.28rem' }}>
                        {rawValue}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        padding: '1.5rem',
        marginTop: '1.5rem',
        boxShadow: '0 16px 36px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(161, 161, 170, 0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{
              alignItems: 'center',
              color: '#B45309',
              display: 'flex',
              fontSize: '0.72rem',
              fontWeight: 900,
              gap: '0.45rem',
              letterSpacing: '0.04em',
              marginBottom: '0.35rem',
              textTransform: 'uppercase',
            }}>
              <ShieldAlert size={14} strokeWidth={2.4} />
              Mainnet Hardening
            </div>
            <h3 style={{ color: '#1A1A1A', fontSize: '1.25rem', fontWeight: 900, lineHeight: 1.1 }}>
              Deployment guardrails before real value is at stake
            </h3>
          </div>
          <div style={{ color: mainnetReadinessIssues.length === 0 ? '#059669' : '#B45309', fontSize: '0.72rem', fontWeight: 900, textAlign: 'right' }}>
            {mainnetReadinessIssues.length === 0
              ? 'Current config passes basic checks'
              : `${mainnetReadinessIssues.length} blocker${mainnetReadinessIssues.length === 1 ? '' : 's'} remaining`}
          </div>
        </div>

        {mainnetReadinessIssues.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {mainnetReadinessIssues.map(issue => (
              <div
                key={issue}
                style={{
                  background: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                  borderRadius: '12px',
                  color: '#92400E',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  padding: '0.85rem 0.9rem',
                }}
              >
                {issue}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.18)',
            borderRadius: '12px',
            color: '#065F46',
            fontSize: '0.8rem',
            fontWeight: 700,
            padding: '0.85rem 0.9rem',
          }}>
            Contract and asset principals are configured. The bridge button will require an explicit mainnet acknowledgement before it can submit a live transaction.
          </div>
        )}

        {requiresMainnetAcknowledge && (
          <label style={{
            alignItems: 'flex-start',
            display: 'flex',
            gap: '0.7rem',
            marginTop: '1rem',
            background: '#F7F8FA',
            border: '1px solid #E4E4E7',
            borderRadius: '12px',
            padding: '0.9rem',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={mainnetAcknowledged}
              onChange={event => setMainnetAcknowledged(event.target.checked)}
              style={{ marginTop: '0.2rem' }}
            />
            <span style={{ color: '#1A1A1A', fontSize: '0.82rem', fontWeight: 700, lineHeight: 1.5 }}>
              I understand that this action will submit a {STACKS_NETWORK} transaction with real assets and strict post-conditions.
            </span>
          </label>
        )}
      </div>

      {isOperator && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '1.5rem',
          marginTop: '1.5rem',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(161, 161, 170, 0.1)',
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              color: '#059669',
              fontSize: '0.72rem',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '0.3rem',
            }}>
              Testnet Operator
            </div>
            <h3 style={{ color: '#1A1A1A', fontSize: '1.3rem', fontWeight: 900, lineHeight: 1.1 }}>
              Mint, fund, fulfill, and reclaim
            </h3>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{
              background: '#F7F8FA',
              border: '1px solid #E4E4E7',
              borderRadius: '16px',
              padding: '1rem',
            }}>
              <div style={{ color: '#71717A', fontSize: '0.72rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                Mint USDCx
              </div>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <input
                  value={mintRecipient}
                  onChange={event => setMintRecipient(event.target.value)}
                  placeholder={walletAddress || 'Recipient principal'}
                  disabled={operatorBusy}
                  style={{
                    border: '1px solid #E4E4E7',
                    borderRadius: '10px',
                    padding: '0.8rem 0.9rem',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <input
                  value={mintAmount}
                  onChange={event => setMintAmount(event.target.value)}
                  placeholder="Amount (USDCx)"
                  disabled={operatorBusy}
                  style={{
                    border: '1px solid #E4E4E7',
                    borderRadius: '10px',
                    padding: '0.8rem 0.9rem',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleMintUsdcx}
                  disabled={operatorBusy}
                  style={{
                    background: operatorBusy ? '#F4F4F5' : '#FEDA15',
                    border: 'none',
                    borderRadius: '10px',
                    color: operatorBusy ? '#71717A' : '#000000',
                    cursor: operatorBusy ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    padding: '0.85rem',
                  }}
                >
                  {operatorAction === 'Mint USDCx' ? 'Minting...' : 'Mint USDCx'}
                </button>
              </div>
            </div>

            <div style={{
              background: '#F7F8FA',
              border: '1px solid #E4E4E7',
              borderRadius: '16px',
              padding: '1rem',
            }}>
              <div style={{ color: '#71717A', fontSize: '0.72rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                Provide Liquidity
              </div>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <select
                  value={liquidityAsset}
                  onChange={event => setLiquidityAsset(event.target.value as AssetSymbol)}
                  disabled={operatorBusy}
                  style={{
                    border: '1px solid #E4E4E7',
                    borderRadius: '10px',
                    padding: '0.8rem 0.9rem',
                    fontSize: '0.9rem',
                    outline: 'none',
                    background: '#FFFFFF',
                  }}
                >
                  {operatorAssetOptions.map(asset => (
                    <option key={asset} value={asset}>
                      {asset}
                    </option>
                  ))}
                </select>
                <input
                  value={liquidityAmount}
                  onChange={event => setLiquidityAmount(event.target.value)}
                  placeholder={`Amount (${liquidityAsset})`}
                  disabled={operatorBusy}
                  style={{
                    border: '1px solid #E4E4E7',
                    borderRadius: '10px',
                    padding: '0.8rem 0.9rem',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleProvideLiquidity}
                  disabled={operatorBusy}
                  style={{
                    background: operatorBusy ? '#F4F4F5' : '#FEDA15',
                    border: 'none',
                    borderRadius: '10px',
                    color: operatorBusy ? '#71717A' : '#000000',
                    cursor: operatorBusy ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    padding: '0.85rem',
                  }}
                >
                  {operatorAction?.includes('Provide') ? 'Funding...' : `Provide ${liquidityAsset}`}
                </button>
              </div>
            </div>

            <div style={{
              background: '#F7F8FA',
              border: '1px solid #E4E4E7',
              borderRadius: '16px',
              padding: '1rem',
            }}>
              <div style={{ color: '#71717A', fontSize: '0.72rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                Fulfill Or Reclaim
              </div>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <input
                  value={fulfillUser}
                  onChange={event => setFulfillUser(event.target.value)}
                  placeholder="Pending intent user"
                  disabled={operatorBusy}
                  style={{
                    border: '1px solid #E4E4E7',
                    borderRadius: '10px',
                    padding: '0.8rem 0.9rem',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <select
                    value={fulfillAsset}
                    onChange={event => setFulfillAsset(event.target.value as AssetSymbol)}
                    disabled={operatorBusy}
                    style={{
                      border: '1px solid #E4E4E7',
                      borderRadius: '10px',
                      padding: '0.8rem 0.9rem',
                      fontSize: '0.9rem',
                      outline: 'none',
                      background: '#FFFFFF',
                    }}
                  >
                    {operatorAssetOptions.map(asset => (
                      <option key={asset} value={asset}>
                        {asset} output
                      </option>
                    ))}
                  </select>
                  <input
                    value={fulfillAmount}
                    onChange={event => setFulfillAmount(event.target.value)}
                    placeholder="Output amount"
                    disabled={operatorBusy}
                    style={{
                      border: '1px solid #E4E4E7',
                      borderRadius: '10px',
                      padding: '0.8rem 0.9rem',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    onClick={handleFulfillSwap}
                    disabled={operatorBusy}
                    style={{
                      background: operatorBusy ? '#F4F4F5' : '#FEDA15',
                      border: 'none',
                      borderRadius: '10px',
                      color: operatorBusy ? '#71717A' : '#000000',
                      cursor: operatorBusy ? 'not-allowed' : 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 900,
                      padding: '0.85rem',
                    }}
                  >
                    {operatorAction === 'Fulfill Swap' ? 'Fulfilling...' : 'Fulfill Swap'}
                  </button>
                  <button
                    onClick={handleReclaimEscrow}
                    disabled={operatorBusy}
                    style={{
                      background: '#111111',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#FFFFFF',
                      cursor: operatorBusy ? 'not-allowed' : 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 900,
                      opacity: operatorBusy ? 0.6 : 1,
                      padding: '0.85rem',
                    }}
                  >
                    {operatorAction === 'Reclaim Escrow' ? 'Reclaiming...' : 'Reclaim Escrow'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        <div style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          gap: '1rem',
        }}>
          <div>
            <div style={{
              alignItems: 'center',
              color: '#059669',
              display: 'flex',
              fontSize: '0.72rem',
              fontWeight: 900,
              gap: '0.45rem',
              letterSpacing: '0.04em',
              marginBottom: '0.3rem',
              textTransform: 'uppercase',
            }}>
              <ShieldCheck size={14} strokeWidth={2.5} />
              Live {STACKS_NETWORK} Status
            </div>
            <h3 style={{ color: '#1A1A1A', fontSize: '1.55rem', fontWeight: 900, letterSpacing: '0', lineHeight: 1 }}>
              Silent Explorer
            </h3>
            <div style={{ color: '#71717A', fontSize: '0.72rem', fontWeight: 700, marginTop: '0.45rem' }}>
              {explorerSyncState === 'syncing'
                ? 'Reconciling Hiro history with the live intent map'
                : explorerSyncState === 'error'
                ? 'History sync paused — showing the latest confirmed cache we have'
                : 'Pending, fulfilled, and reclaimed intents sync from chain history'}
            </div>
          </div>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E7',
            borderRadius: '12px',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.06)',
            minWidth: '142px',
            padding: '0.75rem',
            textAlign: 'right',
          }}>
            <div style={{ color: '#71717A', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Stacks Tip Height
            </div>
            <div style={{ color: '#1A1A1A', fontSize: '1.1rem', fontWeight: 900, marginTop: '0.25rem' }}>
              {stacksInfo ? stacksInfo.tip.toLocaleString() : 'Syncing'}
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gap: '0.9rem',
          marginBottom: '1rem',
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E7',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.85rem 1rem',
          }}>
            <Search size={16} strokeWidth={2.4} color="#71717A" />
            <input
              value={explorerQuery}
              onChange={event => setExplorerQuery(event.target.value)}
              placeholder="Search tx, asset, amount, or preference"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#1A1A1A',
                fontSize: '0.86rem',
                fontWeight: 600,
                outline: 'none',
                width: '100%',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['all', 'Privacy Shielded', 'Fulfilled', 'Reclaimed'] as const).map(status => (
              <button
                key={status}
                onClick={() => setExplorerStatusFilter(status)}
                style={{
                  background: explorerStatusFilter === status ? '#FEDA15' : '#FFFFFF',
                  border: explorerStatusFilter === status ? '1px solid rgba(254, 218, 21, 0.65)' : '1px solid #E4E4E7',
                  borderRadius: '999px',
                  color: explorerStatusFilter === status ? '#000000' : '#71717A',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 900,
                  padding: '0.5rem 0.8rem',
                }}
              >
                {status === 'all' ? 'All statuses' : status}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {explorerAssetOptions.map(asset => (
              <button
                key={asset}
                onClick={() => setExplorerAssetFilter(asset)}
                style={{
                  background: explorerAssetFilter === asset ? '#111111' : '#FFFFFF',
                  border: explorerAssetFilter === asset ? '1px solid #111111' : '1px solid #E4E4E7',
                  borderRadius: '999px',
                  color: explorerAssetFilter === asset ? '#FFFFFF' : '#71717A',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 900,
                  padding: '0.5rem 0.8rem',
                }}
              >
                {asset === 'all' ? 'All assets' : asset}
              </button>
            ))}
            <span style={{ color: '#71717A', fontSize: '0.76rem', fontWeight: 700, marginLeft: 'auto' }}>
              Showing {Math.min(filteredExplorerTransactions.length, 6)} of {explorerTransactions.length}
            </span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}>
          {filteredExplorerTransactions.slice(0, 6).map(renderShieldedCard)}
        </div>
        {filteredExplorerTransactions.length === 0 && (
          <div style={{
            background: '#FFFFFF',
            border: '1px dashed #D4D4D8',
            borderRadius: '16px',
            color: '#71717A',
            fontSize: '0.84rem',
            fontWeight: 700,
            marginTop: '1rem',
            padding: '1rem',
            textAlign: 'center',
          }}>
            No explorer cards match the current filters yet.
          </div>
        )}
      </div>

      {showSuccessModal && successTxHash && (
        <div
          onClick={() => setShowSuccessModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#121212',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '400px',
              width: '100%',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                fontSize: '2rem',
              }}>
                ✓
              </div>
              <h3 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                Intent Broadcasted
              </h3>
              <p style={{ color: '#888', fontSize: '0.9rem' }}>
              Stacks {STACKS_NETWORK} transaction submitted
              </p>
            </div>
            <div style={{
              background: 'rgba(5, 5, 5, 0.6)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
              border: '1px solid rgba(254, 218, 21, 0.1)',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>
                Transaction ID:
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                color: '#FEDA15',
                wordBreak: 'break-all',
              }}>
                {successTxHash}
              </div>
            </div>
            <button
              onClick={() => {
                setShowSuccessModal(false);
                setSuccessTxHash(null);
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '12px',
                border: 'none',
                background: '#FEDA15',
                color: '#000000',
                fontSize: '1rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes shield-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(254, 218, 21, 0.65);
            opacity: 1;
          }
          70% {
            box-shadow: 0 0 0 10px rgba(254, 218, 21, 0);
            opacity: 0.78;
          }
          100% {
            box-shadow: 0 0 0 0 rgba(254, 218, 21, 0);
            opacity: 1;
          }
        }

        .shield-pulse {
          animation: shield-pulse 1.6s ease-out infinite;
        }
      `}</style>
    </div>
  );
}
