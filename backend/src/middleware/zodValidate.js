// Zod validation middleware for Express
const { ZodError } = require("zod");

function validateBody(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.validated = parsed;
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: "Validation error", details: err.errors });
      }
      next(err);
    }
  };
}

module.exports = { validateBody };
