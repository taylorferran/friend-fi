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

// Privy configuration
// Note: Logo and branding are configured directly in the Privy Dashboard
export const privyConfig: PrivyClientConfig = {
  loginMethods: ['email'], // Email only as specified
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
  defaultChain: movementTestnet,
  supportedChains: [movementTestnet],
};
