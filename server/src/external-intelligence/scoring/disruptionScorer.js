/**
 * Severity scoring engine.
 *
 * Formula (news / gdelt):
 *   severity = (0.4 × keyword_intensity) + (0.3 × sentiment_strength) + (0.3 × volume_score)
 *
 * Weather has fixed severity bands.
 */

// ── News / GDELT scoring ──────────────────────────────────────────────────────

const scoreNewsSignal = ({
  keyword_intensity = 0,
  sentiment_compound = 0,
  article_count = 1,
}) => {
  // keyword_intensity is already 0-100
  const kw = Math.min(keyword_intensity, 100);

  // sentiment_strength: map -1…0 to 0…100 (only negative matters)
  const sentStrength = sentiment_compound < 0 ? Math.abs(sentiment_compound) * 100 : 0;

  // volume: log-scale clamp
  const vol = Math.min(Math.log2(article_count + 1) * 15, 100);

  const severity = 0.4 * kw + 0.3 * sentStrength + 0.3 * vol;
  return Math.round(Math.min(severity, 100));
};

// ── Weather scoring ────────────────────────────────────────────────────────────

const WEATHER_BANDS = {
  storm: 80,
  heavy_rain: 60,
  flood: 85,
  heatwave: 40,
  extreme_cold: 45,
};

const scoreWeatherSignal = ({ wind_speed = 0, rain_mm = 0, temp_c = 0, alerts = [] }) => {
  let severity = 0;

  if (wind_speed > 20) severity = Math.max(severity, WEATHER_BANDS.storm);
  if (rain_mm > 50) severity = Math.max(severity, WEATHER_BANDS.heavy_rain);
  if (temp_c > 40) severity = Math.max(severity, WEATHER_BANDS.heatwave);
  if (temp_c < -20) severity = Math.max(severity, WEATHER_BANDS.extreme_cold);
  if (alerts.length > 0) severity = Math.max(severity, WEATHER_BANDS.flood);

  return severity;
};

module.exports = { scoreNewsSignal, scoreWeatherSignal };
