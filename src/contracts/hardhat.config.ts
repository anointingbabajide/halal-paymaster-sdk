import { SUPPORTED_CHAINS } from "./chians";
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: { evmVersion: "cancun" },
      },
      {
        version: "0.8.23",
        settings: { evmVersion: "cancun" },
      },
    ],
  },
  networks: {
    hardhat: {},
    sepolia: {
      url: SUPPORTED_CHAINS.sepolia.rpcUrls.default,
      accounts: [process.env.PRIVATE_KEY],
    },
    arbitrumSepolia: {
      url: SUPPORTED_CHAINS.arbitrumSepolia.rpcUrls.default,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
