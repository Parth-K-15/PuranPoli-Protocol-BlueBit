module.exports = {
  newsapi: {
    key: process.env.NEWSAPI_KEY,
    baseUrl: "https://newsapi.org/v2/everything",
  },
  openweather: {
    key: process.env.OPENWEATHER_KEY,
    baseUrl: "https://api.openweathermap.org/data/2.5/weather",
  },
  googleNews: {
    baseUrl: "https://news.google.com/rss/search",
  },
};
