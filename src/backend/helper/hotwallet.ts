export const getEVMHotWallet = (): string => {
  const wallet = process.env.EVM_HOT_WALLET;
  if (!wallet) throw new Error("EVM_HOT_WALLET is not set");
  return wallet;
};

export const getSolanaHotWallet = (): string => {
  const wallet = process.env.SOLANA_HOT_WALLET_ADDRESS;
  if (!wallet) throw new Error("SOLANA_HOT_WALLET_ADDRESS is not set");
  return wallet;
};

export const getTronHotWallet = (): string => {
  const wallet = process.env.TRON_HOT_WALLET_ADDRESS;
  if (!wallet) throw new Error("TRON_HOT_WALLET_ADDRESS is not set");
  return wallet;
};
