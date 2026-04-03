import { Router } from "express";
import { triggerSweep, getSweepHistory } from "../contollers/sweep.contoller";
import { authenticateInternal } from "../middleware/auth";

const router = Router();

router.post("/trigger", authenticateInternal, triggerSweep);
router.get("/history/:walletAddress", authenticateInternal, getSweepHistory);

export default router;
