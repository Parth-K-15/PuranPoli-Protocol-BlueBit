const neo4j = require("neo4j-driver");

let driver;

const connectNeo4j = async () => {
  driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );

  try {
    await driver.verifyConnectivity();
    console.log(`Neo4j connected: ${process.env.NEO4J_URI}`);
  } catch (err) {
    console.warn(`Neo4j connection failed (graph features unavailable): ${err.message}`);
    await driver.close();
    driver = null;
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
