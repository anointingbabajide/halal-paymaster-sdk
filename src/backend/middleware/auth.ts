import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
  walletAddress?: string;
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      walletAddress: string;
    };

    req.userId = decoded.userId;
    req.walletAddress = decoded.walletAddress;

    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const authenticateInternal = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const apiKey = req.headers["x-internal-api-key"];

  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
};