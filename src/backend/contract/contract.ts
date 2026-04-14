import { ethers } from "ethers";
import { ChainConfig, CHAIN_CONFIGS } from "../config/chains";
import config from "../config/index";
import PAYMASTER_ABI from "./abi/HalalPaymasterAbi.json";
import ERC20_ABI from "./abi/ERC20Abi.json";

const signer = new ethers.Wallet(config.signerPrivateKey);

const getProvider = (chainConfig: ChainConfig): ethers.JsonRpcProvider => {
  return new ethers.JsonRpcProvider(chainConfig.rpcUrl);
};

const getPaymasterContract = (chainConfig: ChainConfig): ethers.Contract => {
  const provider = getProvider(chainConfig);
  return new ethers.Contract(
    (chainConfig as any).paymasterAddress,
    PAYMASTER_ABI,
    provider,
  );
};

const getTokenContract = (
  tokenAddress: string,
  chainConfig: ChainConfig,
): ethers.Contract => {
  const provider = getProvider(chainConfig);
  return new ethers.Contract(tokenAddress, ERC20_ABI, provider);
};

// default instances for Sepolia (backwards compatibility)
const provider = getProvider(CHAIN_CONFIGS.sepolia);
const paymasterContract = getPaymasterContract(CHAIN_CONFIGS.sepolia);

export {
  signer,
  provider,
  paymasterContract,
  ERC20_ABI,
  getProvider,
  getPaymasterContract,
  getTokenContract,
};
