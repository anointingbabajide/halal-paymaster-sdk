const { Pool } = require("pg");
const TronWeb = require("tronweb");
const { HDNodeWallet, Mnemonic } = require("ethers");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env"),
});

const TRON_CHAIN_CONFIGS: Record<string, any> = {
  tronShasta: {
    name: "Tron Shasta Testnet",
    fullHost: "https://api.shasta.trongrid.io",
    usdtAddress: "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs",
  },
};

const USDT_AMOUNT = 2 * 1_000_000; // 2 USDT
const ACTIVATION_AMOUNT = 2_000_000; // 1 TRX — activates account on-chain
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const deriveTronPrivateKey = (mnemonic: string, index: number): string => {
  const masterWallet = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic));
  const purpose = masterWallet.deriveChild(44 + 0x80000000);
  const coinType = purpose.deriveChild(195 + 0x80000000);
  const account = coinType.deriveChild(0 + 0x80000000);
  const change = account.deriveChild(0);
  return change.deriveChild(index).privateKey.slice(2);
};

const deriveTronAddress = (privateKey: string): string => {
  return TronWeb.address.fromPrivateKey(privateKey);
};

const getNextHdIndex = async (): Promise<number> => {
  const result = await pool.query(
    `SELECT COALESCE(MAX(hd_index) + 1, 0) AS next_index FROM wallets`,
  );
  return result.rows[0].next_index;
};

async function seedTronWallets() {
  const networkName = process.argv[2] || "tronShasta";
  const chain = TRON_CHAIN_CONFIGS[networkName];

  if (!chain) {
    console.error(
      `Unsupported network: ${networkName}. Valid options: ${Object.keys(TRON_CHAIN_CONFIGS).join(", ")}`,
    );
    process.exit(1);
  }

  const mnemonic = process.env.HD_MNEMONIC;
  if (!mnemonic) {
    console.error("Missing HD_MNEMONIC in .env");
    process.exit(1);
  }

  const seederPrivateKey = process.env.TRON_FEE_PAYER_PRIVATE_KEY;
  if (!seederPrivateKey) {
    console.error("Missing TRON_FEE_PAYER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  console.log(`Seeding 10 Tron wallets on ${chain.name}...`);
  console.log(
    `Each wallet will be activated with 1 TRX (business cost ~$0.10/wallet)`,
  );

  const tronWeb = new TronWeb({
    fullHost: chain.fullHost,
    headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY || "" },
    privateKey: seederPrivateKey,
  });

  const seederAddress = tronWeb.address.fromPrivateKey(seederPrivateKey);
  console.log("Seeder wallet:", seederAddress);

  // check seeder TRX balance
  // needs: 10 TRX for activation + fees for USDT transfers
  const seederTRXBalance = await tronWeb.trx.getBalance(seederAddress);
  const seederTRX = seederTRXBalance / 1_000_000;
  console.log(`Seeder TRX balance: ${seederTRX} TRX`);

  if (seederTRX < 100) {
    console.error(`Insufficient TRX (need at least 100 TRX)`);
    console.error(`Go to https://shasta.trongrid.io to get test TRX`);
    console.error(`Seeder address: ${seederAddress}`);
    process.exit(1);
  }

  // check seeder USDT balance
  const TRC20_ABI = [
    {
      name: "balanceOf",
      inputs: [{ type: "address" }],
      outputs: [{ type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
    {
      name: "transfer",
      inputs: [{ type: "address" }, { type: "uint256" }],
      outputs: [{ type: "bool" }],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];

  const usdtContract = await tronWeb.contract(TRC20_ABI, chain.usdtAddress);
  const seederUsdtBalance = await usdtContract.balanceOf(seederAddress).call();
  const seederUSDT = Number(seederUsdtBalance.toString()) / 1_000_000;
  const required = (USDT_AMOUNT / 1_000_000) * 10;

  console.log(`Seeder USDT balance: ${seederUSDT} USDT`);
  console.log(`Required for seeding 10 wallets: ${required} USDT`);

  if (seederUSDT < required) {
    console.error(`Insufficient USDT on seeder wallet.`);
    console.error(`Get Shasta USDT from https://shasta.trongrid.io`);
    console.error(`Seeder address: ${seederAddress}`);
    process.exit(1);
  }

  const userResult = await pool.query(
    `INSERT INTO users (email, kyc_status, tier)
     VALUES ('test-tron@halalpayment.com', 'verified', 'basic')
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
  );
  const testUserId = userResult.rows[0].id;
  console.log("Test user ID:", testUserId);

  const startIndex = await getNextHdIndex();
  console.log(`Starting HD derivation from index ${startIndex}`);

  for (let i = 0; i < 10; i++) {
    const hdIndex = startIndex + i;

    try {
      const privateKey = deriveTronPrivateKey(mnemonic, hdIndex);
      const walletAddress = deriveTronAddress(privateKey);

      console.log(`\n[${i + 1}/10] HD index: ${hdIndex}`);
      console.log(`[${i + 1}/10] Wallet address: ${walletAddress}`);

      // ── Step 1: Activate account ──────────────────────────────────────────
      // Tron accounts must receive TRX to exist on-chain
      // Without activation, no transactions can be executed even with
      // delegated energy/bandwidth
      // Cost: 1 TRX (~$0.10) per wallet — one time business cost
      const activationTx = await tronWeb.transactionBuilder.sendTrx(
        walletAddress,
        ACTIVATION_AMOUNT,
        seederAddress,
      );
      const signedActivation = await tronWeb.trx.sign(
        activationTx,
        seederPrivateKey,
      );
      const activationReceipt =
        await tronWeb.trx.sendRawTransaction(signedActivation);

      if (!activationReceipt.result) {
        throw new Error(
          `Activation failed: ${JSON.stringify(activationReceipt)}`,
        );
      }

      console.log(
        `[${i + 1}/10] Activated with 1 TRX | tx: ${activationReceipt.txid}`,
      );

      // wait for activation to confirm on-chain before sending USDT
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // ── Step 2: Fund with USDT ────────────────────────────────────────────
      const tx = await tronWeb.transactionBuilder.triggerSmartContract(
        chain.usdtAddress,
        "transfer(address,uint256)",
        {
          feeLimit: 10_000_000, // 10 TRX max fee
          callValue: 0,
          from: seederAddress,
        },
        [
          { type: "address", value: walletAddress },
          { type: "uint256", value: USDT_AMOUNT },
        ],
        seederAddress,
      );

      if (!tx.result?.result) {
        throw new Error(`Failed to build tx: ${JSON.stringify(tx.result)}`);
      }

      const signedTx = await tronWeb.trx.sign(tx.transaction, seederPrivateKey);
      const receipt = await tronWeb.trx.sendRawTransaction(signedTx);

      if (!receipt.result) {
        throw new Error(`Tx failed: ${JSON.stringify(receipt)}`);
      }

      console.log(`[${i + 1}/10] Funded with 2 USDT | tx: ${receipt.txid}`);

      // ── Step 3: Store in DB ───────────────────────────────────────────────
      await pool.query(
        `INSERT INTO wallets (user_id, address, owner_address, hd_index, is_active, chain)
         VALUES ($1, $2, $3, $4, true, 'tron')
         ON CONFLICT (address) DO NOTHING`,
        [testUserId, walletAddress, walletAddress, hdIndex],
      );

      console.log(`[${i + 1}/10] Inserted into DB`);

      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (err) {
      console.error(`[${i + 1}/10] Failed:`, err);
    }
  }

  console.log(`\nAll 10 Tron wallets seeded on ${chain.name}`);
  console.log(`Each wallet has: 1 TRX (activation) + 2 USDT`);
  console.log(
    `Sweep fees covered by energy/bandwidth delegation from fee payer`,
  );
  await pool.end();
}

seedTronWallets()
  .then(() => process.exit(0))
  .catch(console.error);
