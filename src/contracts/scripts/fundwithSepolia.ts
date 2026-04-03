const { Pool: PgPool } = require("pg");
const { parseUnits: parseUnitsEthers } = require("ethers");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env"),
});

const USDC_ADDRESS =
  process.env.USDC_ADDRESS_ARBITRUM_SEPOLIA ||
  "0xfB43078f982b6f03Fe4AACA547B8Decf889f216C";
const USDT_ADDRESS = "0xdCFB5ca72A6dd3D69598844225C04D107121f0E1";
const RPC_URL = "https://arb-sepolia.g.alchemy.com/v2/7i_Xe0um2Bk37SKdIXC6C";

const TOKEN_ABI = ["function mint(address to, uint256 amount) external"];

const usdcAmount = parseUnitsEthers("50", 6);
const USDT_AMOUNT = parseUnitsEthers("50", 6);

async function fundWallets() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network: Arbitrum");

  const pool = new PgPool({ connectionString: process.env.DATABASE_URL });

  // get all active wallets from DB
  const result = await pool.query(
    "SELECT address FROM wallets WHERE is_active = true ORDER BY hd_index ASC",
  );

  const wallets = result.rows.map((r: any) => r.address);
  console.log(`Found ${wallets.length} wallets to fund\n`);

  const usdc = new hre.ethers.Contract(USDC_ADDRESS, TOKEN_ABI, deployer);
  const usdt = new hre.ethers.Contract(USDT_ADDRESS, TOKEN_ABI, deployer);

  for (let i = 0; i < wallets.length; i++) {
    const address = wallets[i];
    console.log(`[${i + 1}/${wallets.length}] Funding ${address}`);

    try {
      // mint USDC
      const usdcTx = await usdc.mint(address, usdcAmount);
      await usdcTx.wait();
      console.log(`[${i + 1}/${wallets.length}] 50 USDC minted`);

      // mint USDT
      const usdtTx = await usdt.mint(address, USDT_AMOUNT);
      await usdtTx.wait();
      console.log(`[${i + 1}/${wallets.length}] 50 USDT minted`);

      console.log(`[${i + 1}/${wallets.length}] Done\n`);
    } catch (err) {
      console.error(
        `[${i + 1}/${wallets.length}]  Failed for ${address}:`,
        err,
      );
    }
  }

  console.log("All wallets funded on Sepolia");
  await pool.end();
}

fundWallets()
  .then(() => process.exit(0))
  .catch(console.error);
