const mongoose = require("mongoose");

const OFFLINE_WORKSPACE_ID = "000000000000000000000001";

const isMongoReady = () => mongoose.connection.readyState === 1;

const mongoUnavailableMessage =
  "MongoDB is not connected. Data-backed features are unavailable.";

module.exports = {
  OFFLINE_WORKSPACE_ID,
  isMongoReady,
  mongoUnavailableMessage,
};
