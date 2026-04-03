import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler";
import routes from "./routes/index";

const app = express();

// security
app.use(helmet());
app.use(cors());

// body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes
app.use("/api/v1", routes);

// health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// error handler — must be last
app.use(errorHandler);

export default app;
