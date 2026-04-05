// Deprecated entry point kept for backward compatibility.
// Use `npm run db:migrate` directly.
// eslint-disable-next-line no-console
console.warn("db:sync is deprecated. Running migrations instead.");
require("./migrate");
