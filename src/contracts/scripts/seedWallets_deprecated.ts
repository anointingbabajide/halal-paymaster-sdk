// const { Pool } = require("pg");
// const { createKernelAccount } = require("@zerodev/sdk");
// const { KERNEL_V3_1, getEntryPoint } = require("@zerodev/sdk/constants");
// const { signerToEcdsaValidator } = require("@zerodev/ecdsa-validator");
// const { createPublicClient, http } = require("viem");
// const { sepolia, arbitrumSepolia } = require("viem/chains");
// const { privateKeyToAccount } = require("viem/accounts");
// const { parseUnits, HDNodeWallet, Mnemonic } = require("ethers");
// require("dotenv").config({
//   path: require("path").resolve(__dirname, "../../../.env"),
// });

// const CHAIN_CONFIGS: Record<string, any> = {
//   sepolia: {
//     name: "Sepolia",
//     viemChain: sepolia,
//     rpcUrl:
//       process.env.RPC_URL_SEPOLIA || "https://sepolia.gateway.tenderly.co",
//     usdcAddress:
//       process.env.USDC_ADDRESS_SEPOLIA ||
//       "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
//   },
//   arbitrumSepolia: {
//     name: "Arbitrum Sepolia",
//     viemChain: arbitrumSepolia,
//     rpcUrl:
//       process.env.RPC_URL_ARBITRUM_SEPOLIA ||
//       "https://sepolia-rollup.arbitrum.io/rpc",
//     usdcAddress:
//       process.env.USDC_ADDRESS_ARBITRUM_SEPOLIA ||
//       "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
//   },
// };

// const USDC_ABI = ["function mint(address to, uint256 amount) external"];
// const USDC_AMOUNT = parseUnits("50", 6);
// const entryPoint = getEntryPoint("0.7");
// const kernelVersion = KERNEL_V3_1;

// const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// // derive private key from mnemonic + index
// const derivePrivateKey = (mnemonic: string, index: number): string => {
//   const masterWallet = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic));
//   return masterWallet.deriveChild(index).privateKey;
// };

// // get the next available HD index from DB
// const getNextHdIndex = async (): Promise<number> => {
//   const result = await pool.query(
//     `SELECT COALESCE(MAX(hd_index) + 1, 0) AS next_index FROM wallets`,
//   );
//   return result.rows[0].next_index;
// };

// async function seedWallet() {
//   const networkName = hre.network.name;
//   const chain = CHAIN_CONFIGS[networkName];

//   if (!chain) {
//     console.error(
//       `Unsupported network: ${networkName}. Valid options: ${Object.keys(
//         CHAIN_CONFIGS,
//       ).join(", ")}`,
//     );
//     process.exit(1);
//   }

//   const mnemonic = process.env.HD_MNEMONIC;
//   if (!mnemonic) {
//     console.error("Missing HD_MNEMONIC in .env");
//     process.exit(1);
//   }

//   console.log(`Seeding 100 ZeroDev smart account wallets on ${chain.name}...`);

//   const publicClient = createPublicClient({
//     chain: chain.viemChain,
//     transport: http(chain.rpcUrl),
//   });

//   const [deployer] = await hre.ethers.getSigners();
//   console.log("Deployer:", deployer.address);

//   const mockUSDC = new hre.ethers.Contract(
//     chain.usdcAddress,
//     USDC_ABI,
//     deployer,
//   );

//   const userResult = await pool.query(
//     `INSERT INTO users (email, kyc_status, tier)
//      VALUES ('test@halalpayment.com', 'verified', 'basic')
//      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
//      RETURNING id`,
//   );
//   const testUserId = userResult.rows[0].id;
//   console.log("Test user ID:", testUserId);

//   // get starting index so we never reuse an index
//   const startIndex = await getNextHdIndex();
//   console.log(`Starting HD derivation from index ${startIndex}`);

//   for (let i = 0; i < 100; i++) {
//     const hdIndex = startIndex + i;

//     try {
//       // derive private key from mnemonic + index
//       const privateKey = derivePrivateKey(mnemonic, hdIndex);
//       const signer = privateKeyToAccount(privateKey as `0x${string}`);
//       const ownerAddress = signer.address;

//       const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
//         signer,
//         entryPoint,
//         kernelVersion,
//       });

//       const account = await createKernelAccount(publicClient, {
//         plugins: { sudo: ecdsaValidator },
//         entryPoint,
//         kernelVersion,
//       });

//       const smartAccountAddress = account.address;

//       console.log(`[${i + 1}/100] HD index: ${hdIndex}`);
//       console.log(`[${i + 1}/100] Owner: ${ownerAddress}`);
//       console.log(`[${i + 1}/100] Smart account: ${smartAccountAddress}`);

//       const mintTx = await mockUSDC.mint(smartAccountAddress, USDC_AMOUNT);
//       await mintTx.wait();
//       console.log(`[${i + 1}/100] Funded with 50 USDC`);

//       // store hd_index instead of private_key
//       await pool.query(
//         `INSERT INTO wallets (user_id, address, owner_address, hd_index, is_active)
//          VALUES ($1, $2, $3, $4, true)
//          ON CONFLICT (address) DO NOTHING`,
//         [testUserId, smartAccountAddress, ownerAddress, hdIndex],
//       );

//       console.log(`[${i + 1}/100] Inserted into DB\n`);
//     } catch (err) {
//       console.error(`[${i + 1}/100] Failed:`, err);
//     }
//   }

//   console.log(
//     `All 100 smart account wallets created and funded on ${chain.name}`,
//   );
//   await pool.end();
// }

// seedWallet()
//   .then(() => process.exit(0))
//   .catch(console.error);
