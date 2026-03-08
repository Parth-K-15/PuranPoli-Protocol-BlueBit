const axios = require("axios");
const { openweather } = require("../../config/apiKeys");
const MonitoredLocation = require("../../models/monitoredLocation");

/**
 * Fetch current weather for a single coordinate.
 */
const fetchWeather = async ({ lat, lon }) => {
  const params = {
    lat,
    lon,
    units: "metric",
    appid: openweather.key,
  };
  const { data } = await axios.get(openweather.baseUrl, { params });
  return data;
};

/**
 * Fetch weather for all active monitored locations from the database.
 * @returns {Promise<Array<{ location: object, weather: object }>>}
 */
const fetchAllWeather = async () => {
  const locations = await MonitoredLocation.find({ active: true }).lean();

  const results = [];
  for (const loc of locations) {
    try {
      const weather = await fetchWeather(loc);
      results.push({ location: loc, weather });
    } catch (err) {
      console.error(`Weather fetch failed for ${loc.city}: ${err.message}`);
    }
  }
  return results;
};

module.exports = { fetchWeather, fetchAllWeather };
