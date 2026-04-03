// const { Pool } = require("pg");
// const {
//   Connection,
//   Keypair,
//   PublicKey,
//   LAMPORTS_PER_SOL,
//   Transaction,
//   sendAndConfirmTransaction,
// } = require("@solana/web3.js");
// const {
//   getAssociatedTokenAddress,
//   createAssociatedTokenAccountInstruction,
//   createTransferInstruction,
//   getAccount,
// } = require("@solana/spl-token");
// const { Mnemonic } = require("ethers");
// const { derivePath } = require("ed25519-hd-key");
// const bs58 = require("bs58");
// require("dotenv").config({
//   path: require("path").resolve(__dirname, "../../../.env"),
// });

// const CHAIN_CONFIGS: Record<string, any> = {
//   solanaDevnet: {
//     name: "Solana Devnet",
//     rpcUrl: "https://api.devnet.solana.com",
//     usdcMint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
//     usdtMint: "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS",
//   },
// };

// const USDC_AMOUNT = 2 * 1_000_000; // 2 USDC (6 decimals)

// const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// const deriveSolanaKeypair = (mnemonic: string, index: number): any => {
//   const seed = Mnemonic.fromPhrase(mnemonic);
//   const seedBuffer = Buffer.from(seed.entropy, "hex");
//   const path = `m/44'/501'/${index}'/0'`;
//   const { key } = derivePath(path, seedBuffer.toString("hex"));
//   return Keypair.fromSeed(key);
// };

// const getNextHdIndex = async (): Promise<number> => {
//   const result = await pool.query(
//     `SELECT COALESCE(MAX(hd_index) + 1, 0) AS next_index FROM wallets`,
//   );
//   return result.rows[0].next_index;
// };

// const airdropSOL = async (
//   connection: any,
//   publicKey: any,
//   amount: number,
// ): Promise<void> => {
//   try {
//     const sig = await connection.requestAirdrop(
//       publicKey,
//       amount * LAMPORTS_PER_SOL,
//     );
//     await connection.confirmTransaction(sig, "confirmed");
//     console.log(`Airdropped ${amount} SOL to ${publicKey.toBase58()}`);
//   } catch (err) {
//     console.warn(`Airdrop failed for ${publicKey.toBase58()}:`, err);
//   }
// };

// async function seedSolanaWallets() {
//   const networkName = process.argv[2] || "solanaDevnet";
//   const chain = CHAIN_CONFIGS[networkName];

//   if (!chain) {
//     console.error(
//       `Unsupported network: ${networkName}. Valid options: ${Object.keys(CHAIN_CONFIGS).join(", ")}`,
//     );
//     process.exit(1);
//   }

//   const mnemonic = process.env.HD_MNEMONIC;
//   if (!mnemonic) {
//     console.error("Missing HD_MNEMONIC in .env");
//     process.exit(1);
//   }

//   const seederPrivateKeyBase58 = process.env.SOLANA_FEE_PAYER_PRIVATE_KEY;
//   if (!seederPrivateKeyBase58) {
//     console.error("Missing SOLANA_FEE_PAYER_PRIVATE_KEY in .env");
//     process.exit(1);
//   }

//   console.log(`Seeding 10 Solana wallets on ${chain.name}...`);
//   console.log(`User wallets get NO SOL — feePayer covers all sweep fees`);

//   const connection = new Connection(chain.rpcUrl, "confirmed");

//   // seeder = the wallet that funds user wallets during seeding
//   // not a deployer — nothing is deployed on Solana
//   const seederKeypair = Keypair.fromSecretKey(
//     bs58.decode(seederPrivateKeyBase58),
//   );
//   console.log("Seeder wallet:", seederKeypair.publicKey.toBase58());

//   // airdrop SOL to seeder for paying token account creation fees
//   await airdropSOL(connection, seederKeypair.publicKey, 2);

//   // check seeder USDC balance before starting
//   const usdcMint = new PublicKey(chain.usdcMint);
//   const seederUsdcAccount = await getAssociatedTokenAddress(
//     usdcMint,
//     seederKeypair.publicKey,
//   );

//   try {
//     const seederTokenInfo = await getAccount(connection, seederUsdcAccount);
//     const seederBalance = Number(seederTokenInfo.amount) / 1_000_000;
//     const required = (USDC_AMOUNT / 1_000_000) * 10;

//     console.log(`Seeder USDC balance: ${seederBalance} USDC`);
//     console.log(`Required for seeding 10 wallets: ${required} USDC`);

//     if (seederBalance < required) {
//       console.error(`Insufficient USDC on seeder wallet.`);
//       console.error(`Go to https://faucet.circle.com (select Solana Devnet)`);
//       console.error(
//         `Fund this address with at least ${required} USDC: ${seederKeypair.publicKey.toBase58()}`,
//       );
//       process.exit(1);
//     }
//   } catch {
//     console.error(`Seeder has no USDC token account.`);
//     console.error(`Go to https://faucet.circle.com (select Solana Devnet)`);
//     console.error(
//       `Fund this address with at least 20 USDC: ${seederKeypair.publicKey.toBase58()}`,
//     );
//     process.exit(1);
//   }

//   const userResult = await pool.query(
//     `INSERT INTO users (email, kyc_status, tier)
//      VALUES ('test-solana@halalpayment.com', 'verified', 'basic')
//      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
//      RETURNING id`,
//   );
//   const testUserId = userResult.rows[0].id;
//   console.log("Test user ID:", testUserId);

//   const startIndex = await getNextHdIndex();
//   console.log(`Starting HD derivation from index ${startIndex}`);

//   for (let i = 0; i < 10; i++) {
//     const hdIndex = startIndex + i;

//     try {
//       // derive Solana keypair from HD mnemonic + index
//       const keypair = deriveSolanaKeypair(mnemonic, hdIndex);
//       const walletPublicKey = keypair.publicKey;
//       const walletAddress = walletPublicKey.toBase58();

//       console.log(`\n[${i + 1}/10] HD index: ${hdIndex}`);
//       console.log(`[${i + 1}/10] Wallet address: ${walletAddress}`);
//       // no SOL airdrop to user wallet — feePayer handles all sweep fees

//       // get user wallet USDC token account address
//       const walletUsdcAccount = await getAssociatedTokenAddress(
//         usdcMint,
//         walletPublicKey,
//       );

//       const transaction = new Transaction();

//       // create user wallet USDC token account if it does not exist
//       // seeder pays for this — user needs zero SOL
//       const accountInfo = await connection.getAccountInfo(walletUsdcAccount);
//       if (!accountInfo) {
//         transaction.add(
//           createAssociatedTokenAccountInstruction(
//             seederKeypair.publicKey, // seeder pays for account creation
//             walletUsdcAccount,
//             walletPublicKey,
//             usdcMint,
//           ),
//         );
//       }

//       // transfer 2 USDC from seeder to user wallet
//       transaction.add(
//         createTransferInstruction(
//           seederUsdcAccount, // from: seeder USDC account
//           walletUsdcAccount, // to: user USDC account
//           seederKeypair.publicKey, // authority: seeder
//           USDC_AMOUNT, // 2 USDC
//         ),
//       );

//       const txSig = await sendAndConfirmTransaction(
//         connection,
//         transaction,
//         [seederKeypair], // only seeder signs — user wallet not needed
//         { commitment: "confirmed" },
//       );

//       console.log(`[${i + 1}/10] Funded with 2 USDC | tx: ${txSig}`);

//       // store wallet in DB
//       // owner_address = wallet address itself (no separate owner on Solana)
//       // chain = 'solana' to distinguish from EVM wallets
//       await pool.query(
//         `INSERT INTO wallets (user_id, address, owner_address, hd_index, is_active, chain)
//          VALUES ($1, $2, $3, $4, true, 'solana')
//          ON CONFLICT (address) DO NOTHING`,
//         [testUserId, walletAddress, walletAddress, hdIndex],
//       );

//       console.log(`[${i + 1}/10] Inserted into DB`);
//     } catch (err) {
//       console.error(`[${i + 1}/10] Failed:`, err);
//     }
//   }

//   console.log(`\nAll 10 Solana wallets seeded on ${chain.name}`);
//   console.log(`Each wallet has 2 USDC and 0 SOL`);
//   console.log(
//     `Sweep fees paid by SOLANA_FEE_PAYER_PRIVATE_KEY during sweeping`,
//   );
//   await pool.end();
// }

// seedSolanaWallets()
//   .then(() => process.exit(0))
//   .catch(console.error);
