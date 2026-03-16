const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGODB_URI;

  if (!mongoUrl) {
    console.warn("MongoDB URL missing. Set MONGODB_URL (or MONGODB_URI) in .env.");
    return null;
  }

  try {
    const conn = await mongoose.connect(mongoUrl);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    const hostMatch = mongoUrl.match(/@([^/?]+)/);
    const host = hostMatch ? hostMatch[1] : "<unknown-host>";
    console.error(`MongoDB connection failed for host: ${host}`);
    console.error(error.message);
    return null;
  }
};

module.exports = connectDB;
