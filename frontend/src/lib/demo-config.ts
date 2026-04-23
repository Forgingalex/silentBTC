/**
 * Demo Mode Configuration
 * Set DEMO_MODE=true in your .env.local to enable demo mode
 * This bypasses all complex integrations and shows a working demo
 */

export const isDemoMode = () => {
  if (typeof window !== 'undefined') {
    // Check URL parameter first (for easy testing)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') {
      return true;
    }
    // Check localStorage
    if (localStorage.getItem('demoMode') === 'true') {
      return true;
    }
  }
  // Check environment variable
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
};

export const setDemoMode = (enabled: boolean) => {
  if (typeof window !== 'undefined') {
    if (enabled) {
      localStorage.setItem('demoMode', 'true');
    } else {
      localStorage.removeItem('demoMode');
    }
  }
};

// Demo data
export interface Token {
  symbol: string;
  name: string;
  chain: string;
  address: string;
  decimals: number;
  logo?: string;
}

export interface BridgeTransaction {
  id: string;
  fromToken: Token;
  toToken: Token;
  amount: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  routingPreference?: 'fastest' | 'cheapest';
  route?: string; // e.g., "STX -> sBTC"
}

export const demoData = {
  tokens: [
    { symbol: 'STX', name: 'Stacks', chain: 'Stacks', address: 'native-stx', decimals: 6 },
    { symbol: 'sBTC', name: 'sBTC', chain: 'Stacks', address: 'STX-SBTC', decimals: 8 },
    { symbol: 'USDCx', name: 'USDCx', chain: 'Stacks', address: 'STX-USDCX', decimals: 6 },
  ] as Token[],
  transactions: [
    {
      id: 'intent-mock-fastest',
      fromToken: { symbol: 'STX', name: 'Stacks', chain: 'Stacks', address: 'native-stx', decimals: 6 },
      toToken: { symbol: 'sBTC', name: 'sBTC', chain: 'Stacks', address: 'STX-SBTC', decimals: 8 },
      amount: '25.000000',
      status: 'completed' as const,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      routingPreference: 'fastest' as const,
      route: 'STX -> sBTC',
    },
    {
      id: 'intent-mock-cheapest',
      fromToken: { symbol: 'sBTC', name: 'sBTC', chain: 'Stacks', address: 'STX-SBTC', decimals: 8 },
      toToken: { symbol: 'STX', name: 'Stacks', chain: 'Stacks', address: 'native-stx', decimals: 6 },
      amount: '0.05000000',
      status: 'completed' as const,
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      routingPreference: 'cheapest' as const,
      route: 'sBTC -> STX',
    },
    {
      id: 'intent-mock-usdcx',
      fromToken: { symbol: 'USDCx', name: 'USDCx', chain: 'Stacks', address: 'STX-USDCX', decimals: 6 },
      toToken: { symbol: 'sBTC', name: 'sBTC', chain: 'Stacks', address: 'STX-SBTC', decimals: 8 },
      amount: '100.000000',
      status: 'completed' as const,
      timestamp: new Date(Date.now() - 900000).toISOString(),
      routingPreference: 'fastest' as const,
      route: 'USDCx -> sBTC',
    },
  ] as BridgeTransaction[],
  chains: ['Stacks'],
};
