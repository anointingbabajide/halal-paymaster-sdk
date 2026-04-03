// const hre = require("hardhat");
require("dotenv").config();

async function deposit() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Depositing ETH into Paymaster...");
  console.log(
    "Deployer balance:",
    hre.ethers.formatEther(
      await deployer.provider.getBalance(deployer.address),
    ),
    "ETH",
  );

  const paymaster = await hre.ethers.getContractAt(
    "HalalPaymaster",
    process.env.PAYMASTER_ADDRESS,
    // process.env.PAYMASTER_ADDRESS_ARBITRUM_SEPOLIA,
  );

  // deposit 0.02 ETH for gas sponsorship
  const depositTx = await paymaster.deposit({
    value: hre.ethers.parseEther("0.005"),
  });
  await depositTx.wait();
  console.log("Deposited 0.005 ETH");

  // stake 0.01 ETH — required by bundlers
  const stakeTx = await paymaster.addStake(86400, {
    value: hre.ethers.parseEther("0.005"),
  });
  await stakeTx.wait();
  console.log("Staked 0.005 ETH");

  // verify
  const ep = await hre.ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function getDepositInfo(address) view returns (uint112,bool,uint112,uint32,uint48)",
    ],
    "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  );

  const deposit = await ep.balanceOf(process.env.PAYMASTER_ADDRESS);
  console.log("Paymaster deposit:", hre.ethers.formatEther(deposit), "ETH");
}

deposit()
  .then(() => process.exit(0))
  .catch(console.error);
