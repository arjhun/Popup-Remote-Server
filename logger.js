import { pino } from "pino";
import config from "./server.config.js";

const logger = pino({
  level: config.log.logLevel,
  redact: { paths: ["password", "token", "auth.secret", "email.smtpPass"] },
});

export default logger;
