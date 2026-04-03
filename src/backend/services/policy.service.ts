import pool from "../config/db";
import redisClient from "../config/redis";
import config from "../config/index";
import { AppError } from "../middleware/errorHandler";

interface PolicyCheckParams {
  userId: string;
  walletAddress: string;
  userOp: {
    sender: string;
    callData: string;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    callGasLimit: string;
  };
}

const DAILY_GAS_CAP_WEI = BigInt(config.maxGasPerOp) * 100n; // 100 ops per day max
const MAX_GAS_PER_OP_WEI = BigInt(config.maxGasPerOp);

export const checkPolicy = async ({
  userId,
  walletAddress,
  userOp,
}: PolicyCheckParams): Promise<void> => {
  // 1. check user exists and is KYC verified
  const userResult = await pool.query(
    "SELECT id, kyc_status, tier FROM users WHERE id = $1",
    [userId],
  );

  if (userResult.rows.length === 0) {
    throw new AppError("User not found", 404);
  }

  const user = userResult.rows[0];

  if (user.kyc_status !== "verified") {
    throw new AppError("User is not KYC verified", 403);
  }

  // 2. check wallet belongs to this user
  const walletResult = await pool.query(
    "SELECT id FROM wallets WHERE user_id = $1 AND address = $2",
    [userId, walletAddress],
  );

  if (walletResult.rows.length === 0) {
    throw new AppError("Wallet does not belong to this user", 403);
  }

  // 3. estimate max cost of this operation
  const maxFeePerGas = BigInt(userOp.maxFeePerGas);
  const callGasLimit = BigInt(userOp.callGasLimit);
  const estimatedCost = maxFeePerGas * callGasLimit;

  // 4. check per-operation gas cap
  if (estimatedCost > MAX_GAS_PER_OP_WEI) {
    throw new AppError("Operation gas cost exceeds maximum allowed", 400);
  }

  // 5. check daily spend cap from Redis
  const dailyKey = `daily_spend:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const dailySpend = await redisClient.get(dailyKey);
  const currentSpend = dailySpend ? BigInt(dailySpend) : 0n;

  if (currentSpend + estimatedCost > DAILY_GAS_CAP_WEI) {
    throw new AppError("Daily gas spend cap exceeded", 429);
  }

  // 6. update daily spend in Redis — expires at midnight
  const secondsUntilMidnight = getSecondsUntilMidnight();
  await redisClient
    .multi()
    .set(dailyKey, (currentSpend + estimatedCost).toString())
    .expire(dailyKey, secondsUntilMidnight)
    .exec();
};

const getSecondsUntilMidnight = (): number => {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
};
