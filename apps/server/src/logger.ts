import pino from "pino";
import { env } from "./env.js";

/** JSON-Logs in Produktion (für CloudWatch & Co.), lesbare Ausgabe lokal. */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "2t2m-server" },
  redact: ["req.headers.cookie", "req.headers.authorization", 'res.headers["set-cookie"]'],
  transport: env.isProd ? undefined : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname,service" } },
});
