import { defineChain } from 'viem';
import type { PrivyClientConfig } from '@privy-io/react-auth';

// Movement Network Testnet Configuration
export const movementTestnet = defineChain({
  id: 30732,
  name: 'Movement Testnet',
  network: 'movement-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MOVE',
    symbol: 'MOVE',
  },
  rpcUrls: {
    default: {
      http: ['https://mevm.testnet.imola.movementlabs.xyz'],
    },
    public: {
      http: ['https://mevm.testnet.imola.movementlabs.xyz'],
    },
  },
  blockExplorers: {
    default: { 
      name: 'Movement Explorer', 
      url: 'https://explorer.testnet.imola.movementlabs.xyz' 
    },
  },
  testnet: true,
});

// Logo as data URI for Privy (more reliable than file path)
const logoDataUri = "data:image/svg+xml,%3Csvg viewBox='0 0 48 48' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='15' cy='12' r='7' fill='%237311d4'/%3E%3Cpath d='M4 40C4 31.1634 11.1634 24 20 24C23.3137 24 26 26.6863 26 30V40C26 41.6569 24.6569 43 23 43H7C5.34315 43 4 41.6569 4 40Z' fill='%237311d4' fill-opacity='0.7'/%3E%3Ccircle cx='33' cy='12' r='7' fill='%237311d4'/%3E%3Cpath d='M22 40C22 31.1634 29.1634 24 38 24C41.3137 24 44 26.6863 44 30V40C44 41.6569 42.6569 43 41 43H25C23.3431 43 22 41.6569 22 40Z' fill='%237311d4'/%3E%3C/svg%3E";

// Privy configuration
export const privyConfig: PrivyClientConfig = {
  loginMethods: ['email'], // Email only as specified
  appearance: {
    theme: 'dark',
    accentColor: '#7311d4' as `#${string}`,
    logo: logoDataUri,
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
  defaultChain: movementTestnet,
  supportedChains: [movementTestnet],
};
