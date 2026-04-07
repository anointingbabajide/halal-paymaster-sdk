import { TableConfig, WalletTableConfig } from "../types";

// ─── Default Table Config ─────────────────────────────────────────────────────
const DEFAULT_WALLET_TABLE: Required<WalletTableConfig> = {
  tableName: "wallets",
  addressColumn: "address",
  chainColumn: "chain",
  hdIndexColumn: "hd_index",
  isActiveColumn: "is_active",
};

const DEFAULT_SWEEP_HISTORY_TABLE = {
  tableName: "sweep_history",
};

export interface WalletRow {
  address: string;
  chain: string;
  hd_index: number;
  is_active: boolean;
}

export class DBAdapter {
  private dbType: "mysql" | "postgresql";
  private databaseUrl: string;
  private pool: any;
  private walletTable: Required<WalletTableConfig>;
  private sweepHistoryTable: { tableName: string };

  constructor(
    databaseUrl: string,
    dbType: "mysql" | "postgresql",
    tableConfig?: TableConfig,
  ) {
    this.databaseUrl = databaseUrl;
    this.dbType = dbType;

    // merge user config with defaults
    this.walletTable = {
      ...DEFAULT_WALLET_TABLE,
      ...tableConfig?.wallets,
    };

    this.sweepHistoryTable = {
      ...DEFAULT_SWEEP_HISTORY_TABLE,
      ...tableConfig?.sweepHistory,
    };
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
    if (this.pool) await this.pool.end();
  }

  public async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (this.dbType === "mysql") {
      const [rows] = await this.pool.execute(sql, params);
      return rows as T[];
    } else {
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      const result = await this.pool.query(pgSql, params);
      return result.rows as T[];
    }
  }

  // helper to quote column/table names based on DB type
  private quoteIdentifier(name: string): string {
    if (this.dbType === "mysql") {
      return `\`${name}\``;
    } else {
      return `"${name}"`;
    }
  }

  async getWalletsByChainType(chainType: string): Promise<WalletRow[]> {
    const {
      tableName,
      chainColumn,
      isActiveColumn,
      addressColumn,
      hdIndexColumn,
    } = this.walletTable;

    const q = this.quoteIdentifier.bind(this);

    const rows = await this.query<any>(
      `SELECT 
      ${q(addressColumn)} as address,
      ${q(chainColumn)} as chain,
      ${q(hdIndexColumn)} as hd_index,
      ${q(isActiveColumn)} as is_active
     FROM ${q(tableName)}
     WHERE ${q(chainColumn)} = ? AND ${q(isActiveColumn)} = true`,
      [chainType],
    );
    return rows;
  }

  async getWalletByAddress(address: string): Promise<WalletRow | null> {
    const {
      tableName,
      addressColumn,
      hdIndexColumn,
      chainColumn,
      isActiveColumn,
    } = this.walletTable;

    const q = this.quoteIdentifier.bind(this);

    const rows = await this.query<any>(
      `SELECT 
      ${q(addressColumn)} as address,
      ${q(chainColumn)} as chain,
      ${q(hdIndexColumn)} as hd_index,
      ${q(isActiveColumn)} as is_active
     FROM ${q(tableName)}
     WHERE ${q(addressColumn)} = ?`,
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
    const { tableName } = this.sweepHistoryTable;
    await this.query(
      `INSERT INTO ${tableName}
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
    const { tableName } = this.sweepHistoryTable;
    await this.query(
      `INSERT INTO ${tableName}
        (wallet_address, chain_id, token, amount, tx_hash, status, error, created_at)
       VALUES (?, ?, ?, '0', NULL, 'failed', ?, NOW())`,
      [walletAddress, chainId, token, error],
    );
  }

  async getSweepHistory(address: string) {
    const { tableName } = this.sweepHistoryTable;
    return this.query(
      `SELECT * FROM ${tableName}
       WHERE wallet_address = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [address],
    );
  }
}
