export const SUPPORTED_CHAINS = {
  arbitrumSepolia: {
    chainId: 421614,
    name: "Arbitrum Sepolia",
    nativeCurrency: {
      name: "Arbitrum Sepolia ETH",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: "https://sepolia-rollup.arbitrum.io/rpc",
      alchemy: "https://arb-sepolia.g.alchemy.com/v2/",
      infura: "https://arbitrum-sepolia.infura.io/v3/",
      tenderly: "https://arbitrum-sepolia.gateway.tenderly.co",
    },
    blockExplorers: {
      default: {
        name: "Arbiscan Sepolia",
        url: "https://sepolia.arbiscan.io",
      },
    },
    contracts: {
      entryPoint: {
        address: "0x0000000071727De22E8e0f3854697CBD5eB57632",
        blockCreated: 38771,
      },
      HalalPaymaster: {
        address: "0xCA8D59028F6EbE77CA141218011802042AC04227",
      },
    },
    testnet: true,
  },
  sepolia: {
    chainId: 11155111,
    name: "Sepolia",
    nativeCurrency: {
      name: "Sepolia ETH",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: "https://sepolia.gateway.tenderly.co",
      alchemy: "https://eth-sepolia.g.alchemy.com/v2/",
      infura: "https://sepolia.infura.io/v3/",
    },
    blockExplorers: {
      default: {
        name: "Sepolia Explorer",
        url: "https://sepolia.etherscan.io",
      },
    },
    contracts: {
      entryPoint: {
        address: "0x0000000071727De22E8e0f3854697CBD5eB57632",
        blockCreated: 2869060,
      },
      HalalPaymaster: {
        address: "0x32999F27e86e1430B17693D7aB962B8B25c8fcBC",
      },
    },
    testnet: true,
  },
};
