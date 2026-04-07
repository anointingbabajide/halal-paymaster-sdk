CREATE TABLE sponsored_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  wallet_address VARCHAR(100) NOT NULL,
  user_op_hash VARCHAR(100) UNIQUE NOT NULL,
  gas_cost VARCHAR(78),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sponsored_ops_user_id ON sponsored_operations(user_id);
CREATE INDEX idx_sponsored_ops_wallet ON sponsored_operations(wallet_address);
CREATE INDEX idx_sponsored_ops_created_at ON sponsored_operations(created_at);