const { StatusCodes } = require("http-status-codes");

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  let message = err.message || "Internal Server Error";

  if (err?.code === 11000) {
    statusCode = StatusCodes.CONFLICT;
    const fields = Object.keys(err.keyValue || {});
    message =
      fields.length > 0
        ? `${fields.join(", ")} already exists`
        : "Duplicate key error";
  } else if (err?.name === "ValidationError") {
    statusCode = StatusCodes.BAD_REQUEST;
    const first = Object.values(err.errors || {})[0];
    message = first?.message || "Validation failed";
  } else if (err?.name === "CastError") {
    statusCode = StatusCodes.BAD_REQUEST;
    message = `Invalid value for ${err.path}`;
  }

  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;
