import { NextRequest, NextResponse } from 'next/server';
import {
  applyBps,
  getExpectedOutputBaseUnits,
  normalizePair,
  quoteConfig,
} from '@/lib/quote-config';

const DECIMALS = {
  STX: 6,
  sBTC: 8,
} as const;

const formatUnits = (amount: bigint, decimals: number) => {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
};

export async function GET(request: NextRequest) {
  const fromAsset = request.nextUrl.searchParams.get('fromAsset') || '';
  const toAsset = request.nextUrl.searchParams.get('toAsset') || '';
  const inputAmount = request.nextUrl.searchParams.get('inputAmount') || '';
  const preference = request.nextUrl.searchParams.get('preference') || 'fastest';

  const pair = normalizePair(fromAsset, toAsset);
  if (!pair) {
    return NextResponse.json({ error: 'Unsupported pair.' }, { status: 400 });
  }

  if (!/^\d+$/.test(inputAmount)) {
    return NextResponse.json({ error: 'inputAmount must be base-unit integer text.' }, { status: 400 });
  }

  const inputAmountBaseUnits = BigInt(inputAmount);
  if (inputAmountBaseUnits <= 0n) {
    return NextResponse.json({ error: 'inputAmount must be greater than zero.' }, { status: 400 });
  }

  const expectedOutputAmount = getExpectedOutputBaseUnits(
    pair,
    inputAmountBaseUnits,
    quoteConfig.stxUsd,
    quoteConfig.btcUsd
  );

  const minimumOutputAmount = applyBps(
    applyBps(expectedOutputAmount, quoteConfig.feeBps),
    quoteConfig.slippageBps
  );

  const quotedAt = new Date();
  const expiresAt = new Date(quotedAt.getTime() + quoteConfig.quoteTtlSeconds * 1000);
  const targetDecimals = DECIMALS[toAsset as keyof typeof DECIMALS];

  return NextResponse.json({
    pair,
    preference,
    inputAmount,
    expectedOutputAmount: expectedOutputAmount.toString(),
    expectedOutputDisplay: formatUnits(expectedOutputAmount, targetDecimals),
    minimumOutputAmount: minimumOutputAmount.toString(),
    minimumOutputDisplay: formatUnits(minimumOutputAmount, targetDecimals),
    solverFeeBps: quoteConfig.feeBps,
    slippageBufferBps: quoteConfig.slippageBps,
    sourceName: quoteConfig.sourceName,
    sourceEndpoint: quoteConfig.sourceEndpoint,
    sourceSnapshot: {
      stxUsd: quoteConfig.stxUsd,
      btcUsd: quoteConfig.btcUsd,
    },
    quotedAt: quotedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    freshnessThresholdSeconds: quoteConfig.freshnessSeconds,
    fallbackSource: quoteConfig.fallbackSource,
    loggingDestination: quoteConfig.loggingDestination,
  });
}
