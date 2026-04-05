const CURRENCY_SCALE = 100;

const majorToMinor = (value) => {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const raw = String(value).trim();
  if (!/^[-+]?\d+(\.\d{0,})?$/.test(raw)) {
    return 0;
  }

  const sign = raw.startsWith("-") ? -1 : 1;
  const normalized = raw.replace(/^[-+]/, "");
  const [wholePart, fractionPart = ""] = normalized.split(".");
  const cents = (fractionPart + "00").slice(0, 2);

  const whole = Number.parseInt(wholePart || "0", 10);
  const fractional = Number.parseInt(cents || "0", 10);

  if (!Number.isFinite(whole) || !Number.isFinite(fractional)) {
    return 0;
  }

  return sign * (whole * CURRENCY_SCALE + fractional);
};

const minorToMajor = (minor) => {
  const parsed = Number.parseInt(String(minor ?? 0), 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed / CURRENCY_SCALE;
};

const ensureMinorInt = (value) => {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
};

module.exports = {
  CURRENCY_SCALE,
  majorToMinor,
  minorToMajor,
  ensureMinorInt,
};
