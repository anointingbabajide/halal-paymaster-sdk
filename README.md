# @halal/paymaster-sdk

A multi-chain SDK that automatically sweeps USDT and USDC deposits from user wallets to your hot wallet. Users never pay gas fees,the SDK handles all of that.

## How It Works

1. User deposits USDT or USDC to their assigned wallet
2. SDK detects the balance
3. SDK sweeps funds to your hot wallet
4. `onSweepComplete` fires so you can credit the user in your system

## Supported Chains

| Chain               | Tokens          | How Fees Work                           |
| ------------------- | --------------- | --------------------------------------- |
| Ethereum / Arbitrum | USDT, USDC, ETH | ERC-4337 Paymaster — user pays zero ETH |
| Solana              | USDT, USDC, SOL | feePayer pattern — user pays zero SOL   |
| Tron                | USDT, USDC, TRX | Energy delegation — user pays zero TRX  |

## Installation

```bash
npm install @halal/paymaster-sdk
```

## Requirements

- Node.js 18 or higher
- PostgreSQL or MySQL database
- A `wallets` table with `address`, `chain`, `hd_index`, `is_active`
- A `sweep_history` table — the SDK creates and manages this automatically

## Database Setup

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
  chain_id       VARCHAR(50) NOT NULL,
  token          VARCHAR(20) NOT NULL,
  amount         VARCHAR(50) NOT NULL,
  tx_hash        VARCHAR(128),
  status         VARCHAR(20) NOT NULL,
  error          TEXT,
  created_at     DATETIME DEFAULT NOW()
);
```

## Quick Start

```typescript
import { HalalPaymaster } from "@halal/paymaster-sdk";

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

await paymaster.start();
```

## Configuration Options

| Option                   | Type     | Required | Default | Description                            |
| ------------------------ | -------- | -------- | ------- | -------------------------------------- |
| `database.url`           | string   | yes      | -       | Your database connection string        |
| `database.type`          | string   | yes      | -       | `"mysql"` or `"postgresql"`            |
| `keys.hdMnemonic`        | string   | yes      | -       | HD wallet mnemonic for key derivation  |
| `keys.evmSignerKey`      | string   | yes      | -       | EVM signer private key                 |
| `keys.solanaFeePayerKey` | string   | yes      | -       | Solana fee payer private key           |
| `keys.tronFeePayerKey`   | string   | yes      | -       | Tron fee payer private key             |
| `keys.pimlicoApiKey`     | string   | yes      | -       | Pimlico bundler API key                |
| `hotWallets.evm`         | string   | yes      | -       | EVM hot wallet address                 |
| `hotWallets.solana`      | string   | yes      | -       | Solana hot wallet address              |
| `hotWallets.tron`        | string   | yes      | -       | Tron hot wallet address                |
| `chains`                 | string[] | yes      | -       | Which chains to monitor                |
| `sweepInterval`          | number   | no       | 300     | How often to check balances in seconds |
| `sweepThresholdUSD`      | number   | no       | 1       | Minimum USD value to trigger a sweep   |
| `onSweepComplete`        | function | no       | -       | Called when a sweep succeeds           |
| `onSweepFailed`          | function | no       | -       | Called when a sweep fails              |

## Chain Keys

```typescript
"ethereum" | "sepolia" | "arbitrum" | "arbitrumSepolia";
"solana" | "solanaDevnet";
"tron" | "tronShasta";
```

## Sweep Event Shape

```typescript
interface SweepCompleteEvent {
  address: string;
  chain: string;
  token: string;
  amount: string;
  txHash: string;
  timestamp: Date;
}
```

## Fetch Sweep History

```typescript
const history = await paymaster.getSweepHistory("0x...");
```

## Environment Variables

```env
DATABASE_URL=mysql://user:pass@localhost:3306/halal_db
HD_MNEMONIC=your twelve word mnemonic phrase here
EVM_SIGNER_KEY=0x...
SOLANA_FEE_PAYER_KEY=...
TRON_FEE_PAYER_KEY=...
PIMLICO_API_KEY=pim_...
```

## Tron Mainnet Setup

1. Go to https://tronscan.org
2. Stake at least 1000 TRX for ENERGY
3. The SDK automatically delegates energy to user wallets before each sweep
4. Energy regenerates daily — no ongoing cost

## Stop

```typescript
await paymaster.stop();
```

## License

MIT — Anointing Babajide
