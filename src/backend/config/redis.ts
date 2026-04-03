import { createClient } from "redis";

const redisClient = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD!,
  socket: {
    host: process.env.REDIS_HOST!,
    port: Number(process.env.REDIS_PORT!),
  },
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.on("connect", () => console.log("Redis connected"));

export const connectRedis = async () => {
  await redisClient.connect();
};

export default redisClient;
