import { ethers } from "ethers";
import { EVMChainConfig, CHAIN_CONFIGS } from "../config/chains";
import config from "../config/index";
import {
  signer,
  getPaymasterContract,
  getProvider,
} from "../contract/contract";

export const signUserOperation = async (
  userOp: any,
  chainConfig: EVMChainConfig = CHAIN_CONFIGS.sepolia as EVMChainConfig,
): Promise<string> => {
  const validAfter = Math.floor(Date.now() / 1000);
  const validUntil = validAfter + config.signatureExpirySeconds;

  const paymasterContract = getPaymasterContract(chainConfig);
  const provider = getProvider(chainConfig);
  const connectedSigner = signer.connect(provider);

  const initCode = userOp.factory
    ? ethers.concat([userOp.factory, userOp.factoryData || "0x"])
    : "0x";

  const verificationGasLimit = BigInt(userOp.verificationGasLimit || 0);
  const callGasLimit = BigInt(userOp.callGasLimit || 0);
  const accountGasLimits = ethers.zeroPadValue(
    ethers.toBeHex((verificationGasLimit << 128n) | callGasLimit),
    32,
  );

  const maxPriorityFeePerGas = BigInt(userOp.maxPriorityFeePerGas || 0);
  const maxFeePerGas = BigInt(userOp.maxFeePerGas || 0);
  const gasFees = ethers.zeroPadValue(
    ethers.toBeHex((maxPriorityFeePerGas << 128n) | maxFeePerGas),
    32,
  );

  const paymasterVerificationGasLimit = 200000n;
  const paymasterPostOpGasLimit = 100000n;
  const paymasterGasLimitsPacked = ethers.zeroPadValue(
    ethers.toBeHex(
      (paymasterVerificationGasLimit << 128n) | paymasterPostOpGasLimit,
    ),
    32,
  );

  const paymasterAndDataForHash = ethers.concat([
    chainConfig.paymasterAddress,
    paymasterGasLimitsPacked,
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint48", "uint48"],
      [validUntil, validAfter],
    ),
    "0x" + "00".repeat(65),
  ]);

  const hash = await paymasterContract.getHash(
    {
      sender: userOp.sender,
      nonce: userOp.nonce,
      initCode,
      callData: userOp.callData,
      accountGasLimits,
      preVerificationGas: userOp.preVerificationGas || 0,
      gasFees,
      paymasterAndData: paymasterAndDataForHash,
      signature: userOp.signature || "0x",
    },
    validUntil,
    validAfter,
  );

  console.log(`[${chainConfig.name}] Hash from contract getHash: ${hash}`);

  const signature = await connectedSigner.signMessage(ethers.getBytes(hash));

  const paymasterData = ethers.concat([
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint48", "uint48"],
      [validUntil, validAfter],
    ),
    signature,
  ]);

  return paymasterData;
};
