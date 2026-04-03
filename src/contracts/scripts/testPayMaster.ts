// const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [signer] = await hre.ethers.getSigners();

  const paymaster = await hre.ethers.getContractAt(
    "HalalPaymaster",
    process.env.PAYMASTER_ADDRESS,
  );

  const paused = await paymaster.paused();
  console.log("Paused:", paused);

  const signerAddress = await paymaster.signerAddress();
  console.log("Contract signer:", signerAddress);
  console.log("Our signer:     ", signer.address);
  console.log(
    "Match:",
    signerAddress.toLowerCase() === signer.address.toLowerCase(),
  );

  const ep = await hre.ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  );
  const deposit = await ep.balanceOf(process.env.PAYMASTER_ADDRESS);
  console.log("Deposit:", hre.ethers.formatEther(deposit), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
