import { pino } from "pino";

import config from "./server.config.js";
const logger = pino({
  level: config.log.logLevel,
});

export default logger;
