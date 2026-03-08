/**
 * Country detection from article text.
 * Scans text for country names and city aliases to tag disruption events
 * with the correct country instead of "Multiple".
 */

const COUNTRIES = [
  { name: "China", code: "CN", capital: "Beijing", lat: 39.91, lon: 116.40, aliases: ["chinese", "beijing", "shanghai", "shenzhen", "wuhan", "guangzhou", "chengdu", "hangzhou", "nanjing"] },
  { name: "India", code: "IN", capital: "New Delhi", lat: 28.61, lon: 77.21, aliases: ["indian", "mumbai", "hyderabad", "ahmedabad", "delhi", "chennai", "kolkata", "pune", "bangalore"] },
  { name: "Iran", code: "IR", capital: "Tehran", lat: 35.69, lon: 51.39, aliases: ["iranian", "tehran", "persian", "isfahan", "tabriz", "shiraz", "mashhad"] },
  { name: "USA", code: "US", capital: "Washington", lat: 38.90, lon: -77.04, aliases: ["united states", "american", "u.s.", "us ", "new york", "houston", "raleigh", "chicago", "los angeles", "california", "texas", "new jersey"] },
  { name: "Germany", code: "DE", capital: "Berlin", lat: 52.52, lon: 13.41, aliases: ["german", "berlin", "hamburg", "munich", "frankfurt", "bayer", "basf"] },
  { name: "Japan", code: "JP", capital: "Tokyo", lat: 35.68, lon: 139.69, aliases: ["japanese", "tokyo", "osaka", "nagoya", "yokohama"] },
  { name: "South Korea", code: "KR", capital: "Seoul", lat: 37.57, lon: 126.98, aliases: ["korean", "seoul", "busan", "incheon", "samsung", "hyundai"] },
  { name: "Switzerland", code: "CH", capital: "Bern", lat: 46.95, lon: 7.45, aliases: ["swiss", "basel", "zurich", "novartis", "roche"] },
  { name: "Ireland", code: "IE", capital: "Dublin", lat: 53.35, lon: -6.26, aliases: ["irish", "dublin", "cork", "pfizer ireland"] },
  { name: "UK", code: "GB", capital: "London", lat: 51.51, lon: -0.13, aliases: ["united kingdom", "british", "britain", "london", "manchester", "liverpool", "gsk", "astrazeneca"] },
  { name: "France", code: "FR", capital: "Paris", lat: 48.86, lon: 2.35, aliases: ["french", "paris", "lyon", "marseille", "sanofi"] },
  { name: "Brazil", code: "BR", capital: "Brasilia", lat: -15.79, lon: -47.88, aliases: ["brazilian", "são paulo", "sao paulo", "rio de janeiro"] },
  { name: "Russia", code: "RU", capital: "Moscow", lat: 55.76, lon: 37.62, aliases: ["russian", "moscow", "kremlin", "st petersburg"] },
  { name: "Indonesia", code: "ID", capital: "Jakarta", lat: -6.21, lon: 106.85, aliases: ["indonesian", "jakarta", "surabaya"] },
  { name: "Mexico", code: "MX", capital: "Mexico City", lat: 19.43, lon: -99.13, aliases: ["mexican", "mexico city", "guadalajara"] },
  { name: "Singapore", code: "SG", capital: "Singapore", lat: 1.35, lon: 103.82, aliases: ["singaporean"] },
  { name: "Netherlands", code: "NL", capital: "Amsterdam", lat: 52.37, lon: 4.90, aliases: ["dutch", "amsterdam", "rotterdam", "the hague"] },
  { name: "UAE", code: "AE", capital: "Abu Dhabi", lat: 24.45, lon: 54.65, aliases: ["emirati", "dubai", "abu dhabi", "jebel ali"] },
  { name: "Saudi Arabia", code: "SA", capital: "Riyadh", lat: 24.71, lon: 46.68, aliases: ["saudi", "riyadh", "jeddah"] },
  { name: "Turkey", code: "TR", capital: "Ankara", lat: 39.93, lon: 32.85, aliases: ["turkish", "ankara", "istanbul"] },
  { name: "Australia", code: "AU", capital: "Canberra", lat: -35.28, lon: 149.13, aliases: ["australian", "sydney", "melbourne", "brisbane", "perth"] },
  { name: "Canada", code: "CA", capital: "Ottawa", lat: 45.42, lon: -75.70, aliases: ["canadian", "toronto", "montreal", "vancouver", "ottawa"] },
  { name: "South Africa", code: "ZA", capital: "Pretoria", lat: -25.75, lon: 28.19, aliases: ["south african", "johannesburg", "cape town", "durban"] },
  { name: "Israel", code: "IL", capital: "Tel Aviv", lat: 32.08, lon: 34.78, aliases: ["israeli", "tel aviv", "jerusalem", "teva"] },
  { name: "Italy", code: "IT", capital: "Rome", lat: 41.90, lon: 12.50, aliases: ["italian", "rome", "milan", "naples"] },
  { name: "Spain", code: "ES", capital: "Madrid", lat: 40.42, lon: -3.70, aliases: ["spanish", "madrid", "barcelona"] },
  { name: "Pakistan", code: "PK", capital: "Islamabad", lat: 33.69, lon: 73.04, aliases: ["pakistani", "karachi", "lahore", "islamabad"] },
  { name: "Bangladesh", code: "BD", capital: "Dhaka", lat: 23.81, lon: 90.41, aliases: ["bangladeshi", "dhaka", "chittagong"] },
  { name: "Vietnam", code: "VN", capital: "Hanoi", lat: 21.03, lon: 105.85, aliases: ["vietnamese", "hanoi", "ho chi minh"] },
  { name: "Thailand", code: "TH", capital: "Bangkok", lat: 13.76, lon: 100.50, aliases: ["thai", "bangkok"] },
  { name: "Egypt", code: "EG", capital: "Cairo", lat: 30.04, lon: 31.24, aliases: ["egyptian", "cairo", "suez", "suez canal"] },
  { name: "Nigeria", code: "NG", capital: "Abuja", lat: 9.06, lon: 7.49, aliases: ["nigerian", "lagos", "abuja"] },
  { name: "Poland", code: "PL", capital: "Warsaw", lat: 52.23, lon: 21.01, aliases: ["polish", "warsaw", "krakow"] },
  { name: "Taiwan", code: "TW", capital: "Taipei", lat: 25.03, lon: 121.57, aliases: ["taiwanese", "taipei", "tsmc"] },
  { name: "Ukraine", code: "UA", capital: "Kyiv", lat: 50.45, lon: 30.52, aliases: ["ukrainian", "kyiv", "kiev", "odessa"] },
  { name: "Iraq", code: "IQ", capital: "Baghdad", lat: 33.31, lon: 44.37, aliases: ["iraqi", "baghdad", "basra"] },
  { name: "Syria", code: "SY", capital: "Damascus", lat: 33.51, lon: 36.29, aliases: ["syrian", "damascus"] },
  { name: "Afghanistan", code: "AF", capital: "Kabul", lat: 34.53, lon: 69.17, aliases: ["afghan", "kabul"] },
  { name: "Philippines", code: "PH", capital: "Manila", lat: 14.60, lon: 120.98, aliases: ["filipino", "philippine", "manila"] },
  { name: "Malaysia", code: "MY", capital: "Kuala Lumpur", lat: 3.14, lon: 101.69, aliases: ["malaysian", "kuala lumpur"] },
  { name: "Argentina", code: "AR", capital: "Buenos Aires", lat: -34.60, lon: -58.38, aliases: ["argentine", "buenos aires"] },
  { name: "Chile", code: "CL", capital: "Santiago", lat: -33.45, lon: -70.67, aliases: ["chilean", "santiago"] },
  { name: "Colombia", code: "CO", capital: "Bogota", lat: 4.71, lon: -74.07, aliases: ["colombian", "bogota"] },
  { name: "Peru", code: "PE", capital: "Lima", lat: -12.05, lon: -77.04, aliases: ["peruvian", "lima"] },
  { name: "Kenya", code: "KE", capital: "Nairobi", lat: -1.29, lon: 36.82, aliases: ["kenyan", "nairobi"] },
];

// Build a lookup map: lowercase name/alias → country object
const _lookup = new Map();
for (const c of COUNTRIES) {
  _lookup.set(c.name.toLowerCase(), c);
  for (const alias of c.aliases) {
    _lookup.set(alias.toLowerCase(), c);
  }
}

/**
 * Detect most likely country from article text.
 * Returns the first matched country object, or null.
 */
function detectCountry(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Check full country names first (higher confidence)
  for (const c of COUNTRIES) {
    if (lower.includes(c.name.toLowerCase())) return c;
  }

  // Then check aliases
  for (const c of COUNTRIES) {
    for (const alias of c.aliases) {
      if (lower.includes(alias)) return c;
    }
  }

  return null;
}

/**
 * Detect ALL countries mentioned in text.
 */
function detectAllCountries(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Map();

  for (const c of COUNTRIES) {
    if (found.has(c.name)) continue;
    if (lower.includes(c.name.toLowerCase())) {
      found.set(c.name, c);
      continue;
    }
    for (const alias of c.aliases) {
      if (lower.includes(alias)) {
        found.set(c.name, c);
        break;
      }
    }
  }

  return [...found.values()];
}

/**
 * Get country info by name (case-insensitive).
 */
function getCountryByName(name) {
  if (!name) return null;
  return _lookup.get(name.toLowerCase()) || null;
}

module.exports = { detectCountry, detectAllCountries, getCountryByName, COUNTRIES };
