import { Router } from "express";
import paymasterRoutes from "./paymaster";
import sweepRoutes from "./sweep";
// import walletRoutes from "./wallet";

const router = Router();

router.use("/paymaster", paymasterRoutes);
router.use("/sweep", sweepRoutes);
// router.use("/wallet", walletRoutes);

export default router;
