import { Router } from "express";
import { signUserOp } from "../contollers/paymaster.controller";
import { authenticate } from "../middleware/auth";
import { rateLimiter } from "../middleware/ratelimit";
import { checkAllPaymasterBalances } from "../services/reserve.monitor.service";

const router = Router();

// POST /api/v1/paymaster/sign
router.post("/sign", authenticate, rateLimiter, signUserOp);

// GET /api/v1/paymaster/status
// returns ETH deposit balance for all chains
router.get("/status", authenticate, async (req, res) => {
  try {
    const balances = await checkAllPaymasterBalances();
    const anyLow = balances.some((b) => b.isLow);

    res.json({
      status: anyLow ? "low" : "ok",
      balances: balances.map((b) => ({
        chain: b.chain,
        paymasterAddress: b.paymasterAddress,
        balanceEth: b.balanceEth,
        isLow: b.isLow,
      })),
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
