import { Response, NextFunction } from "express";
import { AuthRequest } from "../middleware/auth";
import { signUserOperation } from "../services/paymaster.service";
import { checkPolicy } from "../services/policy.service";
import { AppError } from "../middleware/errorHandler";

export const signUserOp = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userOp } = req.body;

    if (!userOp) {
      throw new AppError("UserOperation is required", 400);
    }

    // check policy before signing
    await checkPolicy({
      userId: req.userId!,
      walletAddress: req.walletAddress!,
      userOp,
    });

    // sign the operation
    const paymasterAndData = await signUserOperation(userOp);

    res.status(200).json({
      status: "success",
      data: { paymasterAndData },
    });
  } catch (err) {
    next(err);
  }
};
