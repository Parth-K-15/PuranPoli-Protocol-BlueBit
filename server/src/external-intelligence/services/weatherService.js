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
 * Fetch current weather by city name and optional country code.
 * @param {string} city
 * @param {string} [countryCode] — ISO 3166 country code e.g. "IR"
 */
const fetchWeatherByCity = async (city, countryCode) => {
  if (!openweather.key) return null;
  const q = countryCode ? `${city},${countryCode}` : city;
  try {
    const { data } = await axios.get(openweather.baseUrl, {
      params: { q, units: "metric", appid: openweather.key },
    });
    return data;
  } catch {
    return null;
  }
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

module.exports = { fetchWeather, fetchWeatherByCity, fetchAllWeather };
