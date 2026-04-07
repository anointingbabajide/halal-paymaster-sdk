const { Pool } = require("pg");
const { createPublicClient, http } = require("viem");
const { sepolia, arbitrumSepolia } = require("viem/chains");
const { privateKeyToAccount } = require("viem/accounts");
const { parseUnits, HDNodeWallet, Mnemonic } = require("ethers");
const { createSmartAccountClient } = require("permissionless");
const { toSimpleSmartAccount } = require("permissionless/accounts");
const { entryPoint07Address } = require("viem/account-abstraction");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env"),
});

const CHAIN_CONFIGS: Record<string, any> = {
  sepolia: {
    name: "Sepolia",
    viemChain: sepolia,
    rpcUrl:
      process.env.RPC_URL_SEPOLIA || "https://sepolia.gateway.tenderly.co",
    usdcAddress:
      process.env.USDC_ADDRESS_SEPOLIA ||
      "0xfB43078f982b6f03Fe4AACA547B8Decf889f216C",
  },
  arbitrumSepolia: {
    name: "Arbitrum Sepolia",
    viemChain: arbitrumSepolia,
    rpcUrl:
      process.env.RPC_URL_ARBITRUM_SEPOLIA ||
      "https://sepolia-rollup.arbitrum.io/rpc",
    usdcAddress:
      process.env.USDC_ADDRESS_ARBITRUM_SEPOLIA ||
      "0x3aD4e995499F590124b7C139BC52E4C7dF0B3c08",
  },
};

const USDC_ABI = ["function mint(address to, uint256 amount) external"];
const USDC_AMOUNT = parseUnits("50", 6);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const derivePrivateKey = (mnemonic: string, index: number): string => {
  const masterWallet = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic));
  return masterWallet.deriveChild(index).privateKey;
};

const getNextHdIndex = async (): Promise<number> => {
  const result = await pool.query(
    `SELECT COALESCE(MAX(hd_index) + 1, 0) AS next_index FROM wallets`,
  );
  return result.rows[0].next_index;
};

async function seedWallet() {
  const networkName = hre.network.name;
  const chain = CHAIN_CONFIGS[networkName];

  if (!chain) {
    console.error(
      `Unsupported network: ${networkName}. Valid options: ${Object.keys(
        CHAIN_CONFIGS,
      ).join(", ")}`,
    );
    process.exit(1);
  }

  const mnemonic = process.env.HD_MNEMONIC;
  if (!mnemonic) {
    console.error("Missing HD_MNEMONIC in .env");
    process.exit(1);
  }

  console.log(`Seeding 100 SimpleAccount wallets on ${chain.name}...`);

  const publicClient = createPublicClient({
    chain: chain.viemChain,
    transport: http(chain.rpcUrl),
  });

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const mockUSDC = new hre.ethers.Contract(
    chain.usdcAddress,
    USDC_ABI,
    deployer,
  );

  const userResult = await pool.query(
    `INSERT INTO users (email, kyc_status, tier)
     VALUES ('test@halalpayment.com', 'verified', 'basic')
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
  );
  const testUserId = userResult.rows[0].id;
  console.log("Test user ID:", testUserId);

  const startIndex = await getNextHdIndex();
  console.log(`Starting HD derivation from index ${startIndex}`);

  for (let i = 0; i < 100; i++) {
    const hdIndex = startIndex + i;

    try {
      const privateKey = derivePrivateKey(mnemonic, hdIndex);
      const owner = privateKeyToAccount(privateKey as `0x${string}`);
      const ownerAddress = owner.address;

      // SimpleAccount instead of Kernel
      const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner,
        entryPoint: {
          address: entryPoint07Address,
          version: "0.7",
        },
      });

      const smartAccountAddress = smartAccount.address;

      console.log(`[${i + 1}/100] HD index: ${hdIndex}`);
      console.log(`[${i + 1}/100] Owner: ${ownerAddress}`);
      console.log(`[${i + 1}/100] Smart account: ${smartAccountAddress}`);

      const mintTx = await mockUSDC.mint(smartAccountAddress, USDC_AMOUNT);
      await mintTx.wait();
      console.log(`[${i + 1}/100] Funded with 50 USDC`);

      await pool.query(
        `INSERT INTO wallets (user_id, address, owner_address, hd_index, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (address) DO NOTHING`,
        [testUserId, smartAccountAddress, ownerAddress, hdIndex],
      );

      console.log(`[${i + 1}/100] Inserted into DB\n`);
    } catch (err) {
      console.error(`[${i + 1}/100] Failed:`, err);
    }
  }

  console.log(
    `All 100 SimpleAccount wallets created and funded on ${chain.name}`,
  );
  await pool.end();
}

// seedWallet()
//   .then(() => process.exit(0))
//   .catch(console.error);

const sendToken = async () => {
  try {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const mockUSDC = new hre.ethers.Contract(
      "0x3aD4e995499F590124b7C139BC52E4C7dF0B3c08",
      USDC_ABI,
      deployer,
    );
    const mintTx = await mockUSDC.mint(
      "0x0c041c873Abf61364eFD92f0116b40F26B7e0AaF",
      USDC_AMOUNT,
    );
    await mintTx.wait();
    console.log(` Funded with 50 USDC`);
  } catch (error) {
    console.error("Error sending token:", error);
  }
};

sendToken().catch(console.error);
