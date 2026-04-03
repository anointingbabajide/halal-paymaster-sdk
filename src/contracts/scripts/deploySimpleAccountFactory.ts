// const hre = require("hardhat");

async function mainSimple() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying SimpleAccountFactory with account:", deployer.address);

  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  const SimpleAccountFactory = await hre.ethers.getContractFactory(
    "@account-abstraction/contracts/samples/SimpleAccountFactory.sol:SimpleAccountFactory",
  );

  const factory = await SimpleAccountFactory.deploy(ENTRY_POINT);
  await factory.waitForDeployment();

  console.log("SimpleAccountFactory deployed to:", await factory.getAddress());
}

mainSimple()
  .then(() => process.exit(0))
  .catch(console.error);
