CREATE TABLE sweep_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(100) NOT NULL,
  chain_id       VARCHAR(50),
  token          VARCHAR(10),
  amount         VARCHAR(78),
  tx_hash        VARCHAR(128),
  status         VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error          TEXT,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sweep_history_wallet ON sweep_history(wallet_address);
CREATE INDEX idx_sweep_history_created_at ON sweep_history(created_at);
CREATE INDEX idx_sweep_history_chain ON sweep_history(chain_id);