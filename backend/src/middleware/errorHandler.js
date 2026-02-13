const notFound = (req, res) => {
  res.status(404).json({ message: "Route not found." });
};

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Something went wrong.";
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({ message });
};

module.exports = {
  notFound,
  errorHandler,
};
