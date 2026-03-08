const axios = require("axios");
const { newsapi } = require("../../config/apiKeys");

const SUPPLY_CHAIN_QUERY =
  'port congestion OR factory shutdown OR chemical plant fire OR shipping delay OR dock strike OR production halt OR export ban OR pharmaceutical shortage';

/**
 * Fetch latest supply-chain-related articles from NewsAPI.
 * @param {string} [query] — override default query
 * @returns {Promise<Array>}
 */
const fetchNewsArticles = async (query) => {
  const params = {
    q: query || SUPPLY_CHAIN_QUERY,
    language: "en",
    sortBy: "publishedAt",
    pageSize: 50,
    apiKey: newsapi.key,
  };

  const { data } = await axios.get(newsapi.baseUrl, { params });
  return data.articles || [];
};

module.exports = { fetchNewsArticles };
