const Sentiment = require("sentiment");
const analyzer = new Sentiment();

/**
 * Analyse sentiment of text and return a normalised score.
 * @param {string} text
 * @returns {{ compound: number, isNegative: boolean, raw: object }}
 */
const analyseSentiment = (text) => {
  if (!text) return { compound: 0, isNegative: false, raw: {} };

  const result = analyzer.analyze(text);

  // Normalise comparative score to roughly -1 … +1 range
  const compound = Math.max(-1, Math.min(1, result.comparative));

  return {
    compound,
    isNegative: compound < -0.3,
    raw: result,
  };
};

module.exports = { analyseSentiment };
