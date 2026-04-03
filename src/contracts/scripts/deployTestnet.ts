const hre = require("hardhat");

async function deployTest() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    (await deployer.provider.getBalance(deployer.address)).toString(),
  );

  const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  // for now signer and owner are the same address
  const SIGNER = deployer.address;
  const OWNER = deployer.address;

  const HalalPaymaster = await hre.ethers.getContractFactory("HalalPaymaster");
  const paymaster = await HalalPaymaster.deploy(ENTRY_POINT, SIGNER, OWNER);

  await paymaster.waitForDeployment();

  console.log("HalalPaymaster deployed to:", await paymaster.getAddress());
}

deployTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
