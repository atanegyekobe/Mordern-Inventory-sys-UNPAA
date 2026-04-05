require("./config/env");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const config = require("./config/env");

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
