import { pino } from "pino";

import config from "./server.config.js";
const logger = pino({
  level: config.log.logLevel,
  redact: ["password", "token"],
});

export default logger;
