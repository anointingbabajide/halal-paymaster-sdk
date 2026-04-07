CREATE TABLE wallets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  address       VARCHAR(100) UNIQUE NOT NULL,
  owner_address VARCHAR(100),
  chain         VARCHAR(20) NOT NULL DEFAULT 'evm',
  hd_index      INTEGER NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);