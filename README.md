# @halalfi/paymaster-sdk

A multi-chain paymaster SDK that automatically sweeps USDT and USDC deposits from user wallets to your hot wallet. Users never pay gas fees — the SDK handles all fee sponsorship across EVM, Solana, and Tron.

## How it Works

1. User deposits USDT or USDC to their assigned wallet address
2. SDK detects the balance above your threshold
3. SDK sponsors the gas fee — user pays nothing
4. Funds move to your hot wallet
5. `onSweepComplete` fires so you can credit the user in your own system

## Supported Chains

| Chain               | Tokens          | Fee Model                               |
| ------------------- | --------------- | --------------------------------------- |
| Ethereum / Arbitrum | USDT, USDC, ETH | ERC-4337 Paymaster — user pays zero ETH |
| Solana              | USDT, USDC, SOL | feePayer pattern — user pays zero SOL   |
| Tron                | USDT, USDC, TRX | Energy delegation — user pays zero TRX  |

## Installation

```bash
npm install @halalfi/paymaster-sdk
```

## Requirements

- Node.js 18 or higher
- PostgreSQL or MySQL database
- A `wallets` table with the required columns
- A `sweep_history` table — SDK writes to this automatically

## Database Setup

### MySQL

```sql
CREATE TABLE wallets (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  address    VARCHAR(100) UNIQUE NOT NULL,
  chain      VARCHAR(20) NOT NULL,
  hd_index   INT NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT NOW()
);

CREATE TABLE sweep_history (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  wallet_address VARCHAR(100) NOT NULL,
  chain_id       VARCHAR(50),
  token          VARCHAR(20),
  amount         VARCHAR(78),
  tx_hash        VARCHAR(128),
  status         VARCHAR(20) DEFAULT 'pending',
  error          TEXT,
  created_at     DATETIME DEFAULT NOW()
);
```

### PostgreSQL

```sql
CREATE TABLE wallets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address    VARCHAR(100) UNIQUE NOT NULL,
  chain      VARCHAR(20) NOT NULL,
  hd_index   INTEGER NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sweep_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(100) NOT NULL,
  chain_id       VARCHAR(50),
  token          VARCHAR(20),
  amount         VARCHAR(78),
  tx_hash        VARCHAR(128),
  status         VARCHAR(20) DEFAULT 'pending',
  error          TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);
```

### Already have a wallets table?

If your wallets table exists but is missing columns just add them:

```sql
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS chain VARCHAR(20) DEFAULT 'evm';
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS hd_index INTEGER;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
```

## Quick Start

```typescript
import { HalalPaymaster } from "@halalfi/paymaster-sdk";

const paymaster = new HalalPaymaster({
  database: {
    url: process.env.DATABASE_URL,
    type: "mysql", // or "postgresql"
  },
  keys: {
    hdMnemonic: process.env.HD_MNEMONIC,
    evmSignerKey: process.env.EVM_SIGNER_KEY,
    solanaFeePayerKey: process.env.SOLANA_FEE_PAYER_KEY,
    tronFeePayerKey: process.env.TRON_FEE_PAYER_KEY,
    pimlicoApiKey: process.env.PIMLICO_API_KEY,
  },
  hotWallets: {
    evm: "0x...",
    solana: "...",
    tron: "T...",
  },
  chains: ["arbitrum", "solana", "tron"],
  sweepInterval: 300,
  sweepThresholdUSD: 1,

  onSweepComplete: async (event) => {
    console.log(`Swept ${event.amount} ${event.token} from ${event.address}`);
    await db.creditUser(event.address, event.amount, event.token);
  },

  onSweepFailed: async (event) => {
    console.error(`Sweep failed for ${event.address}: ${event.error}`);
    await db.logSweepError(event);
  },
});

// optional: listen to all SDK logs for admin dashboard
paymaster.on("log", (event) => {
  io.emit("sdk:log", event);
});

// optional: listen to sweep events directly
paymaster.on("sweep:complete", (event) => {
  io.emit("sweep:complete", event);
});

paymaster.on("sweep:failed", (event) => {
  io.emit("sweep:failed", event);
});

await paymaster.start();
```

## EVM Paymaster Funding

Before EVM sweeps can work the paymaster contract must be funded with ETH. The SDK handles this for you.

### Deposit and Stake

```typescript
const result = await paymaster.depositToPaymaster(
  "arbitrum", // chain key
  "0.05", // ETH to deposit for gas sponsorship
  "0.01", // ETH to stake (required by bundlers)
  86400, // unstake delay in seconds — optional, defaults to 86400 (1 day)
);

console.log("Deposit tx:", result.depositTxHash);
console.log("Stake tx:", result.stakeTxHash);
console.log("Current balance:", result.currentBalance, "ETH");
```

### Check Paymaster Balance

```typescript
const balance = await paymaster.getPaymasterBalance("arbitrum");
console.log("Paymaster balance:", balance, "ETH");
```

### Auto Top Up

Set up automatic top up when balance runs low:

```typescript
// check every hour and top up if needed
setInterval(
  async () => {
    const balance = await paymaster.getPaymasterBalance("arbitrum");
    if (parseFloat(balance) < 0.05) {
      console.log("Paymaster balance low, topping up...");
      await paymaster.depositToPaymaster("arbitrum", "0.1", "0.05");
    }
  },
  60 * 60 * 1000,
);
```

### Recommended Flow

```typescript
const paymaster = new HalalPaymaster({ ...config });

// check balance before starting
const balance = await paymaster.getPaymasterBalance("arbitrum");
console.log(`Paymaster balance: ${balance} ETH`);

// top up if low
if (parseFloat(balance) < 0.05) {
  await paymaster.depositToPaymaster("arbitrum", "0.1", "0.05");
}

// start sweep worker
await paymaster.start();
```

## Custom Column Names

If your existing wallets table uses different column names you do not need to change your database. Just map them in the config.

```typescript
const paymaster = new HalalPaymaster({
  database: {
    url: process.env.DATABASE_URL,
    type: "mysql",
    tables: {
      wallets: {
        tableName: "user_wallets", // default: "wallets"
        addressColumn: "wallet_address", // default: "address"
        chainColumn: "blockchain", // default: "chain"
        hdIndexColumn: "key_index", // default: "hd_index"
        isActiveColumn: "enabled", // default: "is_active"
      },
      sweepHistory: {
        tableName: "transactions", // default: "sweep_history"
      },
    },
  },
  // rest of config
});
```

## Configuration

| Option                   | Type     | Required | Default | Description                           |
| ------------------------ | -------- | -------- | ------- | ------------------------------------- |
| `database.url`           | string   | yes      | -       | Database connection string            |
| `database.type`          | string   | yes      | -       | `"mysql"` or `"postgresql"`           |
| `database.tables`        | object   | no       | -       | Custom table and column name mapping  |
| `keys.hdMnemonic`        | string   | yes      | -       | HD wallet mnemonic for key derivation |
| `keys.evmSignerKey`      | string   | yes      | -       | EVM signer private key                |
| `keys.solanaFeePayerKey` | string   | yes      | -       | Solana fee payer private key          |
| `keys.tronFeePayerKey`   | string   | yes      | -       | Tron fee payer private key            |
| `keys.pimlicoApiKey`     | string   | yes      | -       | Pimlico bundler API key               |
| `hotWallets.evm`         | string   | yes      | -       | EVM hot wallet address                |
| `hotWallets.solana`      | string   | yes      | -       | Solana hot wallet address             |
| `hotWallets.tron`        | string   | yes      | -       | Tron hot wallet address               |
| `chains`                 | string[] | yes      | -       | Chains to monitor                     |
| `sweepInterval`          | number   | no       | 300     | Check interval in seconds             |
| `sweepThresholdUSD`      | number   | no       | 1       | Minimum USD value to sweep            |
| `onSweepComplete`        | function | no       | -       | Called when sweep succeeds            |
| `onSweepFailed`          | function | no       | -       | Called when sweep fails               |

## Supported Chain Keys

```typescript
// EVM
"ethereum" | "sepolia" | "arbitrum" | "arbitrumSepolia";

// Solana
"solana" | "solanaDevnet";

// Tron
"tron" | "tronShasta";
```

## Sweep Event

```typescript
interface SweepCompleteEvent {
  address: string; // wallet that was swept
  chain: string; // chain key e.g. "arbitrum"
  token: string; // token e.g. "USDT"
  amount: string; // amount e.g. "100.000000"
  txHash: string; // transaction hash
  timestamp: Date;
}

interface SweepFailedEvent {
  address: string;
  chain: string;
  token: string;
  error: string;
  timestamp: Date;
}

interface SweepLogEvent {
  chain: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: Date;
  data?: any;
}
```

## Get Sweep History

```typescript
const history = await paymaster.getSweepHistory("0x...");
```

## Stop the SDK

```typescript
await paymaster.stop();
```

## Environment Variables

```env
DATABASE_URL=mysql://user:pass@localhost:3306/your_db
HD_MNEMONIC=your twelve word mnemonic phrase here
EVM_SIGNER_KEY=0x...
SOLANA_FEE_PAYER_KEY=...
TRON_FEE_PAYER_KEY=...
PIMLICO_API_KEY=pim_...
```

## Tron Mainnet Setup

On Tron mainnet you need to stake TRX to get energy for gasless sweeps:

1. Go to https://tronscan.org
2. Stake at least 1000 TRX for ENERGY
3. SDK automatically delegates energy to user wallets before each sweep
4. Energy regenerates daily — zero ongoing cost per sweep

## Security

- Never commit `.env` to version control
- Store `HD_MNEMONIC` in a secrets manager in production (AWS KMS, HashiCorp Vault)
- Pin the exact SDK version in your package.json — do not use `latest`
- Validate `onSweepComplete` events against on-chain data before crediting users
- Keep hot wallets funded with minimum operational balance only
- Monitor `sweep_history` table for failed sweeps or unusual activity

```json
{
  "dependencies": {
    "@halalfi/paymaster-sdk": "1.0.2"
  }
}
```

## License

MIT — Anointing Babajide
