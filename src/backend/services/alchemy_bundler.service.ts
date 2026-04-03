// import {
//   createPublicClient,
//   http,
//   encodeFunctionData,
//   parseEther,
//   formatEther,
// } from "viem";
// import { privateKeyToAccount } from "viem/accounts";
// import { HDNodeWallet, Mnemonic } from "ethers";
// import { createSmartAccountClient } from "permissionless";
// import { toSimpleSmartAccount } from "permissionless/accounts";
// import { entryPoint07Address } from "viem/account-abstraction";
// import { ChainConfig, CHAIN_CONFIGS, TokenKey } from "../config/chains";
// import config from "../config/index";
// import pool from "../config/db";
// import { signUserOperation } from "./paymaster.service";
// import { ERC20_ABI } from "../contract/contract";
// import { ETH_MIN_THRESHOLD } from "../contract/constant";

// // HD wallet master — created once, never stored
// let masterWallet: HDNodeWallet | null = null;

// const getMasterWallet = (): HDNodeWallet => {
//   if (!masterWallet) {
//     if (!process.env.HD_MNEMONIC) {
//       throw new Error("HD_MNEMONIC is not set in environment variables");
//     }
//     masterWallet = HDNodeWallet.fromMnemonic(
//       Mnemonic.fromPhrase(process.env.HD_MNEMONIC),
//     );
//   }
//   return masterWallet;
// };

// const derivePrivateKey = (hdIndex: number): `0x${string}` => {
//   return getMasterWallet().deriveChild(hdIndex).privateKey as `0x${string}`;
// };

// export const getPublicClient = (chainConfig: ChainConfig) => {
//   return createPublicClient({
//     chain: chainConfig.viemChain,
//     transport: http(chainConfig.rpcUrl),
//   });
// };

// export const getSmartAccountClient = async (
//   ownerPrivateKey: string,
//   chainConfig: ChainConfig = CHAIN_CONFIGS.sepolia,
// ) => {
//   const publicClient = getPublicClient(chainConfig);
//   const owner = privateKeyToAccount(ownerPrivateKey as `0x${string}`);

//   const smartAccount = await toSimpleSmartAccount({
//     client: publicClient,
//     owner,
//     entryPoint: {
//       address: entryPoint07Address,
//       version: "0.7",
//     },
//   });

//   const smartAccountClient = createSmartAccountClient({
//     account: smartAccount,
//     chain: chainConfig.viemChain,
//     bundlerTransport: http(chainConfig.alchemyRpc),
//     paymaster: {
//       async getPaymasterStubData(userOperation) {
//         const serializedUserOp = JSON.parse(
//           JSON.stringify(userOperation, (_, value) =>
//             typeof value === "bigint" ? value.toString() : value,
//           ),
//         );
//         const paymasterData = await signUserOperation(
//           serializedUserOp,
//           chainConfig,
//         );
//         return {
//           paymaster: chainConfig.paymasterAddress as `0x${string}`,
//           paymasterData: paymasterData as `0x${string}`,
//           paymasterVerificationGasLimit: 200000n,
//           paymasterPostOpGasLimit: 100000n,
//           isFinal: true,
//         };
//       },
//       async getPaymasterData(userOperation) {
//         const serializedUserOp = JSON.parse(
//           JSON.stringify(userOperation, (_, value) =>
//             typeof value === "bigint" ? value.toString() : value,
//           ),
//         );
//         const paymasterData = await signUserOperation(
//           serializedUserOp,
//           chainConfig,
//         );
//         return {
//           paymaster: chainConfig.paymasterAddress as `0x${string}`,
//           paymasterData: paymasterData as `0x${string}`,
//           paymasterVerificationGasLimit: 200000n,
//           paymasterPostOpGasLimit: 100000n,
//         };
//       },
//     },

//     userOperation: {
//       estimateFeesPerGas: async () => {
//         const gasPrice = await publicClient.getGasPrice();
//         const minPriorityFee = 100_000_000n; // 0.1 gwei: Alchemy minimum
//         const priorityFee =
//           gasPrice > minPriorityFee ? gasPrice : minPriorityFee;
//         return {
//           maxFeePerGas: priorityFee * 2n,
//           maxPriorityFeePerGas: priorityFee,
//         };
//       },
//     },
//   });

//   return smartAccountClient;
// };
// export const sweepWalletViaUserOp = async (
//   walletAddress: string,
//   chainConfig: ChainConfig = CHAIN_CONFIGS.sepolia,
//   token: TokenKey = "USDC",
// ): Promise<{ txHash: string; amount: string }> => {
//   const tokenAddress = chainConfig.tokens[token];

//   if (!tokenAddress || tokenAddress.includes("DUMMY")) {
//     console.log(
//       `[${chainConfig.name}] ${token} not configured, skipping ${walletAddress}`,
//     );
//     return { txHash: "", amount: "0" };
//   }

//   try {
//     const result = await pool.query(
//       "SELECT hd_index FROM wallets WHERE address = $1 AND is_active = true",
//       [walletAddress],
//     );

//     if (result.rows.length === 0) {
//       throw new Error(`Wallet not found: ${walletAddress}`);
//     }

//     const { hd_index } = result.rows[0];
//     const privateKey = derivePrivateKey(hd_index);
//     const publicClient = getPublicClient(chainConfig);

//     const balance = await publicClient.readContract({
//       address: tokenAddress as `0x${string}`,
//       abi: ERC20_ABI,
//       functionName: "balanceOf",
//       args: [walletAddress as `0x${string}`],
//     });

//     console.log(
//       `[${chainConfig.name}] Wallet ${walletAddress} ${token} balance: ${balance}`,
//     );

//     if (balance === 0n) {
//       console.log(
//         `[${chainConfig.name}] Wallet ${walletAddress} has zero ${token}, skipping`,
//       );
//       return { txHash: "", amount: "0" };
//     }

//     const smartAccountClient = await getSmartAccountClient(
//       privateKey,
//       chainConfig,
//     );

//     const callData = encodeFunctionData({
//       abi: ERC20_ABI,
//       functionName: "transfer",
//       args: [config.hotWalletAddress as `0x${string}`, balance],
//     });

//     const userOpHash = await smartAccountClient.sendUserOperation({
//       calls: [
//         {
//           to: tokenAddress as `0x${string}`,
//           value: 0n,
//           data: callData,
//         },
//       ],
//     });

//     console.log(`[${chainConfig.name}] UserOperation submitted: ${userOpHash}`);

//     const receipt = (await Promise.race([
//       smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash }),
//       new Promise((_, reject) =>
//         setTimeout(
//           () => reject(new Error("UserOp receipt timeout after 60s")),
//           60_000,
//         ),
//       ),
//     ])) as any;

//     const txHash = receipt.receipt.transactionHash;
//     const amountFormatted = (Number(balance) / 1_000_000).toFixed(6);

//     console.log(
//       `[${chainConfig.name}] Sweep complete: ${amountFormatted} ${token} → ${config.hotWalletAddress}`,
//     );
//     console.log(`[${chainConfig.name}] Tx hash: ${txHash}`);

//     await pool.query(
//       `INSERT INTO sweep_history
//        (wallet_address, chain_id, token, amount, tx_hash, status, created_at)
//        VALUES ($1, $2, $3, $4, $5, 'success', NOW())`,
//       [walletAddress, chainConfig.chainId, token, amountFormatted, txHash],
//     );

//     return { txHash, amount: amountFormatted };
//   } catch (err: any) {
//     const isSenderAlreadyConstructed =
//       err?.shortMessage?.includes("Smart Account has already been deployed") ||
//       err?.cause?.shortMessage?.includes(
//         "Smart Account has already been deployed",
//       ) ||
//       err?.details?.includes("AA10") ||
//       err?.cause?.details?.includes("AA10");

//     if (isSenderAlreadyConstructed) {
//       console.log(
//         `[${chainConfig.name}] Wallet ${walletAddress} already deployed (AA10) — skipping`,
//       );
//       return { txHash: "", amount: "0" };
//     }

//     await pool.query(
//       `INSERT INTO sweep_history
//        (wallet_address, chain_id, token, amount, tx_hash, status, error, created_at)
//        VALUES ($1, $2, $3, '0', NULL, 'failed', $4, NOW())`,
//       [
//         walletAddress,
//         chainConfig.chainId,
//         token,
//         err instanceof Error ? err.message : "Unknown error",
//       ],
//     );
//     throw err;
//   }
// };

// export const sweepNativeETH = async (
//   walletAddress: string,
//   chainConfig: ChainConfig,
// ): Promise<{ txHash: string; amount: string }> => {
//   try {
//     const result = await pool.query(
//       "SELECT hd_index FROM wallets WHERE address = $1 AND is_active = true",
//       [walletAddress],
//     );

//     if (result.rows.length === 0) {
//       throw new Error(`Wallet not found: ${walletAddress}`);
//     }

//     const { hd_index } = result.rows[0];
//     const privateKey = derivePrivateKey(hd_index);
//     const publicClient = getPublicClient(chainConfig);

//     const balance = await publicClient.getBalance({
//       address: walletAddress as `0x${string}`,
//     });

//     console.log(
//       `[${chainConfig.name}] Wallet ${walletAddress} ETH balance: ${balance} wei`,
//     );

//     const MIN_ETH_THRESHOLD = parseEther(ETH_MIN_THRESHOLD.toString());
//     if (balance < MIN_ETH_THRESHOLD) {
//       console.log(
//         `[${chainConfig.name}] Wallet ${walletAddress} ETH balance too low, skipping`,
//       );
//       return { txHash: "", amount: "0" };
//     }

//     const smartAccountClient = await getSmartAccountClient(
//       privateKey,
//       chainConfig,
//     );

//     const userOpHash = await smartAccountClient.sendUserOperation({
//       calls: [
//         {
//           to: config.hotWalletAddress as `0x${string}`,
//           value: balance,
//           data: "0x",
//         },
//       ],
//     });

//     console.log(
//       `[${chainConfig.name}] ETH UserOperation submitted: ${userOpHash}`,
//     );

//     const receipt = (await Promise.race([
//       smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash }),
//       new Promise((_, reject) =>
//         setTimeout(
//           () => reject(new Error("UserOp receipt timeout after 60s")),
//           60_000,
//         ),
//       ),
//     ])) as any;

//     const txHash = receipt.receipt.transactionHash;
//     const amountFormatted = formatEther(balance);

//     console.log(
//       `[${chainConfig.name}] ETH Sweep complete: ${amountFormatted} ETH → ${config.hotWalletAddress}`,
//     );
//     console.log(`[${chainConfig.name}] Tx hash: ${txHash}`);

//     await pool.query(
//       `INSERT INTO sweep_history
//        (wallet_address, chain_id, token, amount, tx_hash, status, created_at)
//        VALUES ($1, $2, 'ETH', $3, $4, 'success', NOW())`,
//       [walletAddress, chainConfig.chainId, amountFormatted, txHash],
//     );

//     return { txHash, amount: amountFormatted };
//   } catch (err: any) {
//     const isSenderAlreadyConstructed =
//       err?.shortMessage?.includes("Smart Account has already been deployed") ||
//       err?.cause?.shortMessage?.includes(
//         "Smart Account has already been deployed",
//       ) ||
//       err?.details?.includes("AA10") ||
//       err?.cause?.details?.includes("AA10");

//     if (isSenderAlreadyConstructed) {
//       console.log(
//         `[${chainConfig.name}] Wallet ${walletAddress} already deployed (AA10) — skipping`,
//       );
//       return { txHash: "", amount: "0" };
//     }

//     await pool.query(
//       `INSERT INTO sweep_history
//        (wallet_address, chain_id, token, amount, tx_hash, status, error, created_at)
//        VALUES ($1, $2, 'ETH', '0', NULL, 'failed', $3, NOW())`,
//       [
//         walletAddress,
//         chainConfig.chainId,
//         err instanceof Error ? err.message : "Unknown error",
//       ],
//     );
//     throw err;
//   }
// };
