import { Request, Response, NextFunction } from "express";
import {
  triggerSweepForWallet,
  getWalletSweepHistory,
} from "../services/sweep.service";
import { AppError } from "../middleware/errorHandler";

export const triggerSweep = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      throw new AppError("walletAddress is required", 400);
    }

    const result = await triggerSweepForWallet(walletAddress);

    res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getSweepHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { walletAddress } = req.params;

    if (!walletAddress || Array.isArray(walletAddress)) {
      throw new AppError("walletAddress is required", 400);
    }

    const history = await getWalletSweepHistory(walletAddress);

    res.status(200).json({
      status: "success",
      data: history,
    });
  } catch (err) {
    next(err);
  }
};
