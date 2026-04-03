// const hre = require("hardhat");
const { ethers } = require("ethers");
require("dotenv").config();

async function testHash() {
  const paymaster = await hre.ethers.getContractAt(
    "HalalPaymaster",
    process.env.PAYMASTER_ADDRESS,
  );

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
    process.env.PAYMASTER_ADDRESS,
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

  const hash = await paymaster.getHash(userOp, validUntil, validAfter);
  console.log("On-chain hash:", hash);
}

testHash()
  .then(() => process.exit(0))
  .catch(console.error);
