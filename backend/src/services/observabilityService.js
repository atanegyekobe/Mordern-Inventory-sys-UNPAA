const metricValues = new Map();
const metricMeta = new Map();

const normalizeTags = (tags = {}) => {
  return Object.keys(tags)
    .sort()
    .reduce((acc, key) => {
      acc[key] = tags[key];
      return acc;
    }, {});
};

const buildMetricKey = (name, tags = {}) => {
  const normalizedTags = normalizeTags(tags);
  const tagPairs = Object.entries(normalizedTags)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");

  return tagPairs ? `${name}|${tagPairs}` : name;
};

const toErrorPayload = (error) => {
  if (!error) {
    return null;
  }

  return {
    message: error.message,
    code: error.code || null,
  };
};

const emitLog = (level, event, payload = {}) => {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...payload,
  };

  if (level === "error") {
    console.error(`[obs] ${event}`, logEntry);
    return;
  }

  if (level === "warn") {
    console.warn(`[obs] ${event}`, logEntry);
    return;
  }

  console.log(`[obs] ${event}`, logEntry);
};

const incrementMetric = (name, amount = 1, tags = {}) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return null;
  }

  const key = buildMetricKey(name, tags);
  const current = metricValues.get(key) || 0;
  const nextValue = current + numericAmount;

  metricValues.set(key, nextValue);
  metricMeta.set(key, { name, tags: normalizeTags(tags) });

  return nextValue;
};

const setMetric = (name, value, tags = {}) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const key = buildMetricKey(name, tags);
  metricValues.set(key, numericValue);
  metricMeta.set(key, { name, tags: normalizeTags(tags) });

  return numericValue;
};

const getMetricsSnapshot = () => {
  return Array.from(metricValues.entries()).map(([key, value]) => {
    const metadata = metricMeta.get(key) || { name: key, tags: {} };
    return {
      name: metadata.name,
      tags: metadata.tags,
      value,
    };
  });
};

const logInfo = (event, payload = {}) => emitLog("info", event, payload);
const logWarn = (event, payload = {}) => emitLog("warn", event, payload);
const logError = (event, payload = {}, error = null) => {
  emitLog("error", event, {
    ...payload,
    error: toErrorPayload(error),
  });
};

module.exports = {
  incrementMetric,
  setMetric,
  getMetricsSnapshot,
  logInfo,
  logWarn,
  logError,
};
