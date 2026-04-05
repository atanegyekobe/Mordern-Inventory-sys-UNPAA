require("./config/env");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const routesModule = require("./routes");
const errorHandlerModule = require("./middleware/errorHandler");
const config = require("./config/env");

const unwrapModuleFunction = (candidate) => {
  let current = candidate;
  let guard = 0;

  while (current && typeof current !== "function" && typeof current === "object" && "default" in current) {
    current = current.default;
    guard += 1;

    if (guard > 5) {
      break;
    }
  }

  return current;
};

const ensureMiddleware = (candidate, name) => {
  const resolved = unwrapModuleFunction(candidate);
  if (typeof resolved !== "function") {
    const shape = resolved && typeof resolved === "object" ? Object.keys(resolved).join(",") : typeof resolved;
    throw new TypeError(`${name} must be an Express middleware function. Received: ${shape}`);
  }
  return resolved;
};

const routes = ensureMiddleware(routesModule, "routes");
const notFound = ensureMiddleware(errorHandlerModule.notFound, "notFound");
const errorHandler = ensureMiddleware(errorHandlerModule.errorHandler, "errorHandler");

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      req.rawBody = buffer.toString("utf8");
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
  })
);

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
