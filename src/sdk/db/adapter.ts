import { SweepCompleteEvent } from "../types";

// ─── DB Row Types ─────────────────────────────────────────────────────────────
export interface WalletRow {
  address: string;
  chain: string;
  hd_index: number;
  is_active: boolean;
}

export interface SweepHistoryRow {
  id: number;
  wallet_address: string;
  chain_id: string;
  token: string;
  amount: string;
  tx_hash: string | null;
  status: string;
  error: string | null;
  created_at: Date;
}

// ─── DB Adapter ───────────────────────────────────────────────────────────────
// Works with both MySQL and PostgreSQL
// Handles query syntax differences internally
export class DBAdapter {
  private dbType: "mysql" | "postgresql";
  private databaseUrl: string;
  private pool: any;

  constructor(databaseUrl: string, dbType: "mysql" | "postgresql") {
    this.databaseUrl = databaseUrl;
    this.dbType = dbType;
  }

  async connect(): Promise<void> {
    if (this.dbType === "mysql") {
      const mysql = await import("mysql2/promise");
      this.pool = mysql.createPool(this.databaseUrl);
      console.log("[SDK] MySQL connected");
    } else {
      const { Pool } = await import("pg");
      this.pool = new Pool({ connectionString: this.databaseUrl });
      console.log("[SDK] PostgreSQL connected");
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  // ─── Query Helper ───────────────────────────────────────────────────────────
  // MySQL uses ? placeholders, PostgreSQL uses $1 $2 $3
  public async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.dbType === "mysql") {
      const [rows] = await this.pool.execute(sql, params);
      return rows as T[];
    } else {
      // convert ? to $1, $2, $3 for PostgreSQL
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      const result = await this.pool.query(pgSql, params);
      return result.rows as T[];
    }
  }

  // ─── Wallet Queries ─────────────────────────────────────────────────────────
  async getWalletsByChainType(chainType: string): Promise<WalletRow[]> {
    return this.query<WalletRow>(
      `SELECT address, chain, hd_index, is_active 
       FROM wallets 
       WHERE chain = ? AND is_active = true`,
      [chainType],
    );
  }

  async getWalletByAddress(address: string): Promise<WalletRow | null> {
    const rows = await this.query<WalletRow>(
      `SELECT address, chain, hd_index, is_active 
       FROM wallets 
       WHERE address = ?`,
      [address],
    );
    return rows[0] ?? null;
  }

  // ─── Sweep History Queries ──────────────────────────────────────────────────
  async recordSweepSuccess(
    walletAddress: string,
    chainId: string,
    token: string,
    amount: string,
    txHash: string,
  ): Promise<void> {
    await this.query(
      `INSERT INTO sweep_history 
        (wallet_address, chain_id, token, amount, tx_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'success', NOW())`,
      [walletAddress, chainId, token, amount, txHash],
    );
  }

  async recordSweepFailure(
    walletAddress: string,
    chainId: string,
    token: string,
    error: string,
  ): Promise<void> {
    await this.query(
      `INSERT INTO sweep_history 
        (wallet_address, chain_id, token, amount, tx_hash, status, error, created_at)
       VALUES (?, ?, ?, '0', NULL, 'failed', ?, NOW())`,
      [walletAddress, chainId, token, error],
    );
  }

  async getSweepHistory(address: string): Promise<SweepHistoryRow[]> {
    return this.query<SweepHistoryRow>(
      `SELECT * FROM sweep_history 
       WHERE wallet_address = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [address],
    );
  }
}
