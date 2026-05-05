require("./config/env");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const routesModule = require("./routes/index.js");
const errorHandlerModule = require("./middleware/errorHandler");

const isExpressMiddleware = (candidate) => typeof candidate === "function";

const extractMiddleware = (candidate, depth = 0) => {
  if (isExpressMiddleware(candidate)) {
    return candidate;
  }

  if (!candidate || typeof candidate !== "object" || depth > 6) {
    return null;
  }

  if ("default" in candidate) {
    const fromDefault = extractMiddleware(candidate.default, depth + 1);
    if (fromDefault) {
      return fromDefault;
    }
  }

  for (const value of Object.values(candidate)) {
    const extracted = extractMiddleware(value, depth + 1);
    if (extracted) {
      return extracted;
    }
  }

  return null;
};

const ensureMiddleware = (candidate, name) => {
  const resolved = extractMiddleware(candidate);
  if (!resolved) {
    const shape = resolved && typeof resolved === "object" ? Object.keys(resolved).join(",") : typeof resolved;
    const candidateShape =
      candidate && typeof candidate === "object" ? Object.keys(candidate).join(",") : typeof candidate;
    throw new TypeError(
      `${name} must be an Express middleware function. Received: ${shape || "unknown"}; candidate shape: ${candidateShape || "unknown"}`
    );
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
app.use(cors({ origin: "*" }));
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

app.get("/", (req, res) => {
  res.send("API is running");
});

app.use("/api", routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
