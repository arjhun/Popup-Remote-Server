//env
import * as dotenv from "dotenv";

dotenv.config();

const config = {
  env: process.env.NODE_ENV || "development",
  log: {
    logLevel:
      process.env.NODE_ENV === "production"
        ? process.env.PROD_LOGLEVEL || "info"
        : process.env.DEV_LOGLEVEL || "trace",
  },
  db: {
    connString: process.env.CONN_STR || "mongodb://127.0.0.1:27017/popups",
  },
  server: {
    corsUrls: process.env.CORS_STR
      ? process.env.CORS_STR.split(" ")
      : ["http://localhost:3000"],
    port: process.env.SERVERPORT || 3005,
  },
  auth: {
    secret: process.env.SECRET_KEY || "", //* please use an enviroment variable
    resetAdmin:
      (process.env.RESET_ADMIN || "false").toLowerCase() === "true" || false,
    accessTokenExpiration: "1 day",
    refreshTokenExpiration: "30 days",
  },
  email: {
    smtpServer: process.env.SMTP_SERVER, //* please use an enviroment variable
    smtpUser: process.env.SMTP_USER, //* please use an enviroment variable
    smtpPass: process.env.SMTP_PASS, //* please use an enviroment variable
    supportEmail: process.env.SUPPORT_EMAIL, //* please use an enviroment variable
    fromEmail: process.env.FROM_EMAIL, //* please use an enviroment variable
    fromName: process.env.FROM_NAME,
  }, //* please use an enviroment variable
};

export default config;
