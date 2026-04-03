import { Request, Response, NextFunction } from "express";
import { AppError } from "../type/error";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // known operational error
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: "error",
      message: err.message,
    });
    return;
  }

  // unknown error
  console.error("Unexpected error:", err);

  res.status(500).json({
    status: "error",
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message,
  });
};
export { AppError };
