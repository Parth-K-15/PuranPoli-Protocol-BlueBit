const { fetchAllWeather, fetchWeatherByCity } = require("../services/weatherService");
const { scoreWeatherSignal } = require("../scoring/disruptionScorer");
const DisruptionEvent = require("../../models/disruptionEvent");
const { Node } = require("../../models/Node");
const { getCountryByName } = require("../detection/countryDetector");

/**
 * Weather ingestion pipeline:
 *  fetch all monitored locations → evaluate thresholds → score → store
 */
const ingestWeather = async () => {
  console.log("[WeatherIngestion] Starting weather ingestion…");
  const results = await fetchAllWeather();
  const saved = [];

  for (const { location, weather } of results) {
    const wind_speed = weather.wind?.speed || 0; // m/s
    const rain_mm = weather.rain?.["1h"] || weather.rain?.["3h"] || 0;
    const temp_c = weather.main?.temp || 0;
    const alerts = weather.alerts || [];
    const description = weather.weather?.[0]?.description || "";

    const severity = scoreWeatherSignal({ wind_speed, rain_mm, temp_c, alerts, description });

    if (severity === 0) continue; // nothing noteworthy

    const eventType = classifyWeatherEvent({ wind_speed, rain_mm, temp_c, alerts, description });
    const desc = buildWeatherDesc(location, weather, eventType);

    const doc = await DisruptionEvent.findOneAndUpdate(
      {
        event_type: eventType,
        source_type: "weather",
        location: location.city,
        detected_at: { $gte: startOfDay() },
      },
      {
        $set: {
          severity_score: severity,
          country: location.country,
          description: desc,
        },
      },
      { upsert: true, new: true }
    );

    saved.push(doc);
  }

  // ── Also check weather for all unique node countries ────────────────────────
  const monitoredCountries = new Set(
    results.map((r) => (r.location.country || "").toLowerCase())
  );
  const nodeCountries = await Node.distinct("country");

  for (const country of nodeCountries) {
    if (!country || monitoredCountries.has(country.toLowerCase())) continue;
    const info = getCountryByName(country);
    if (!info) continue;

    try {
      const weather = await fetchWeatherByCity(info.capital, info.code);
      if (!weather) continue;

      const wind_speed = weather.wind?.speed || 0;
      const rain_mm = weather.rain?.["1h"] || weather.rain?.["3h"] || 0;
      const temp_c = weather.main?.temp || 0;
      const alerts = weather.alerts || [];
      const description = weather.weather?.[0]?.description || "";

      const severity = scoreWeatherSignal({ wind_speed, rain_mm, temp_c, alerts, description });
      if (severity === 0) continue;

      const eventType = classifyWeatherEvent({ wind_speed, rain_mm, temp_c, alerts, description });
      const loc = { city: info.capital, country: country };
      const desc = buildWeatherDesc(loc, weather, eventType);

      const doc = await DisruptionEvent.findOneAndUpdate(
        {
          event_type: eventType,
          source_type: "weather",
          location: info.capital,
          detected_at: { $gte: startOfDay() },
        },
        {
          $set: {
            severity_score: severity,
            country: country,
            description: desc,
          },
        },
        { upsert: true, new: true }
      );
      saved.push(doc);
    } catch (err) {
      console.error(`[WeatherIngestion] Failed for node country ${country}: ${err.message}`);
    }
  }

  console.log(`[WeatherIngestion] Stored ${saved.length} weather event(s).`);
  return saved;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyWeatherEvent({ wind_speed, rain_mm, temp_c, alerts, description = "" }) {
  const desc = (description || "").toLowerCase();
  if (/tsunami/i.test(desc)) return "tsunami";
  if (/cyclone/i.test(desc)) return "cyclone";
  if (/hurricane/i.test(desc)) return "hurricane";
  if (/typhoon/i.test(desc)) return "typhoon";
  if (/tornado/i.test(desc)) return "tornado";
  if (/thunderstorm/i.test(desc)) return "thunderstorm";
  if (/blizzard/i.test(desc)) return "blizzard";
  if (alerts.length > 0) return "severe_weather_alert";
  if (wind_speed > 30) return "cyclone";
  if (wind_speed > 20) return "storm";
  if (rain_mm > 100) return "flood";
  if (rain_mm > 50) return "heavy_rain";
  if (temp_c > 40) return "heatwave";
  if (temp_c < -20) return "extreme_cold";
  return "weather_disruption";
}

function buildWeatherDesc(location, weather, eventType) {
  const label = eventType.replace(/_/g, " ");
  return `${label} detected at ${location.city}, ${location.country}. ` +
    `Temp: ${weather.main?.temp}°C, Wind: ${weather.wind?.speed} m/s, ` +
    `Conditions: ${weather.weather?.[0]?.description || "n/a"}`;
}

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

module.exports = { ingestWeather };
