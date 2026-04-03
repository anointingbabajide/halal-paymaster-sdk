import { ethers } from "ethers";
import config from "../config/index";

const provider = new ethers.JsonRpcProvider(config.rpcUrl);

const PAYMASTER_ABI = [
  "function getHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp, uint48 validUntil, uint48 validAfter) view returns (bytes32)",
];

const paymasterContract = new ethers.Contract(
  config.paymasterAddress,
  PAYMASTER_ABI,
  provider,
);

async function main() {
  const verificationGasLimit = BigInt("0x4dcca");
  const callGasLimit = BigInt("0xa48c");
  const accountGasLimits = ethers.zeroPadValue(
    ethers.toBeHex((verificationGasLimit << 128n) | callGasLimit),
    32,
  );

  const maxPriorityFeePerGas = BigInt("0x234101");
  const maxFeePerGas = BigInt("0x234121");
  const gasFees = ethers.zeroPadValue(
    ethers.toBeHex((maxPriorityFeePerGas << 128n) | maxFeePerGas),
    32,
  );

  const validUntil = 0x69cb735a;
  const validAfter = 0x69cb722e;

  const pmVerifGas = 200000n;
  const pmPostOpGas = 100000n;
  const pmGasLimits = ethers.zeroPadValue(
    ethers.toBeHex((pmVerifGas << 128n) | pmPostOpGas),
    32,
  );

  const paymasterAndData = ethers.concat([
    config.paymasterAddress,
    pmGasLimits,
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint48", "uint48"],
      [validUntil, validAfter],
    ),
    "0x" + "00".repeat(65),
  ]);

  const initCode =
    "0xd703aaE79538628d27099B8c4f621bE4CCd142d5c5265d5d000000000000000000000000aac5d4240af87249b3f71bc8e4a2cae074a3e419000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000124";

  const callData =
    "0xe9ae5c530000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000780000000000000000000000000000000000000000000000000000000000000000";

  const userOp = {
    sender: "0x43F41FC6cc76C8AFBd1f14a69E7DA5593b6070c4",
    nonce: "0x845adb2c711129d4f3966735ed98a9f09fc4ce5700000000000000000000",
    initCode,
    callData,
    accountGasLimits,
    preVerificationGas: 0xd96f,
    gasFees,
    paymasterAndData,
    signature: "0x",
  };

  // call getHash on contract from backend
  const hashFromContract = await paymasterContract.getHash(
    userOp,
    validUntil,
    validAfter,
  );

  console.log("Hash from backend call:", hashFromContract);
  console.log(
    "Expected (from Hardhat):",
    "0xfe4f2b32e641ba531e5114e28d3bffcb76dbddcf07f60471da8ea0527b44ea78",
  );
  console.log(
    "Match:",
    hashFromContract.toLowerCase() ===
      "0xfe4f2b32e641ba531e5114e28d3bffcb76dbddcf07f60471da8ea0527b44ea78",
  );
}

main().catch(console.error);
