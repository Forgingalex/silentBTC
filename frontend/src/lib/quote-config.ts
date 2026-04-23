export type QuotePair = 'STX-sBTC' | 'sBTC-STX';

export type QuoteConfig = {
  sourceName: string;
  sourceEndpoint: string;
  stxUsd: number;
  btcUsd: number;
  feeBps: number;
  slippageBps: number;
  freshnessSeconds: number;
  quoteTtlSeconds: number;
  fallbackSource: string;
  loggingDestination: string;
};

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const appOrigin =
  process.env.NEXT_PUBLIC_APP_ORIGIN ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  'http://localhost:3000';

export const quoteConfig: QuoteConfig = {
  sourceName: process.env.QUOTE_SOURCE_NAME || 'silentBTC internal quote engine',
  sourceEndpoint:
    process.env.QUOTE_SOURCE_ENDPOINT || `${appOrigin.replace(/\/$/, '')}/api/quote`,
  stxUsd: parseNumber(process.env.QUOTE_STX_USD, 2.25),
  btcUsd: parseNumber(process.env.QUOTE_BTC_USD, 78000),
  feeBps: parseNumber(process.env.QUOTE_FEE_BPS, 30),
  slippageBps: parseNumber(process.env.QUOTE_SLIPPAGE_BPS, 50),
  freshnessSeconds: parseNumber(process.env.QUOTE_FRESHNESS_SECONDS, 30),
  quoteTtlSeconds: parseNumber(process.env.QUOTE_TTL_SECONDS, 30),
  fallbackSource: process.env.QUOTE_FALLBACK_SOURCE || 'none; solver pauses if the primary quote source is unavailable',
  loggingDestination: process.env.QUOTE_LOGGING_DESTINATION || 'application logs',
};

export const normalizePair = (fromAsset: string, toAsset: string): QuotePair | null => {
  const pair = `${fromAsset}-${toAsset}`;
  if (pair === 'STX-sBTC' || pair === 'sBTC-STX') return pair;
  return null;
};

export const getExpectedOutputBaseUnits = (
  pair: QuotePair,
  inputAmountBaseUnits: bigint,
  stxUsd: number,
  btcUsd: number
) => {
  const SCALE = 1_000_000_000n;
  const stxPriceScaled = BigInt(Math.round(stxUsd * Number(SCALE)));
  const btcPriceScaled = BigInt(Math.round(btcUsd * Number(SCALE)));

  if (pair === 'STX-sBTC') {
    const inputStx = inputAmountBaseUnits;
    return (inputStx * stxPriceScaled * 100n) / btcPriceScaled;
  }

  const inputSats = inputAmountBaseUnits;
  return (inputSats * btcPriceScaled * 1_000_000n) / (stxPriceScaled * 100_000_000n);
};

export const applyBps = (amount: bigint, bps: number) =>
  (amount * BigInt(10_000 - Math.trunc(bps))) / 10_000n;
