const neo4j = require("neo4j-driver");

let driver;

const connectNeo4j = async () => {
  const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, NEO4J_REQUIRED } = process.env;

  if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
    console.warn("Neo4j config missing. Skipping Neo4j startup.");
    return false;
  }

  try {
    driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD),
      {
        // Keep startup responsive when network blocks Bolt traffic.
        connectionTimeout: 10000,
      }
    );

    await driver.verifyConnectivity();
    console.log(`Neo4j connected: ${NEO4J_URI}`);
    return true;
  } catch (error) {
    if (driver) {
      await driver.close();
      driver = undefined;
    }

    if (NEO4J_REQUIRED === "true") {
      throw error;
    }

    console.warn(`Neo4j unavailable. Continuing without Neo4j. Reason: ${error.message}`);
    return false;
  }
};

const getDriver = () => {
  if (!driver) throw new Error("Neo4j is unavailable. Check your Aura instance or network.");
  return driver;
};

const closeNeo4j = async () => {
  if (driver) await driver.close();
};

module.exports = { connectNeo4j, getDriver, closeNeo4j };
