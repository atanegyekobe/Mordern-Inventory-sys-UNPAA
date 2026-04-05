const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const getEnv = (key, fallback = undefined) =>
  Object.prototype.hasOwnProperty.call(process.env, key)
    ? process.env[key]
    : fallback;

module.exports = {
  env: getEnv("NODE_ENV", "development"),
  port: Number(getEnv("PORT", 4000)),
  databaseUrl: getEnv("DATABASE_URL"),
  dbHost: getEnv("DB_HOST", "localhost"),
  dbPort: Number(getEnv("DB_PORT", 5432)),
  dbName: getEnv("DB_NAME", "ecommerce"),
  dbUser: getEnv("DB_USER", "postgres"),
  dbPassword: getEnv("DB_PASSWORD", ""),
  dbSsl: getEnv("DB_SSL", "false") === "true",
  jwtSecret: getEnv("JWT_SECRET", "change-me"),
  jwtExpiresIn: getEnv("JWT_EXPIRES_IN", "7d"),
  clientOrigin: getEnv("CLIENT_ORIGIN", "http://localhost:3000"),
  paystackSecretKey: getEnv("PAYSTACK_SECRET_KEY"),
  paystackBaseUrl: getEnv("PAYSTACK_BASE_URL", "https://api.paystack.co"),
  paystackCallbackUrl: getEnv("PAYSTACK_CALLBACK_URL"),
  openaiApiKey: getEnv("OPENAI_API_KEY"),
  openaiModel: getEnv("OPENAI_MODEL", "gpt-4o-mini"),
};
