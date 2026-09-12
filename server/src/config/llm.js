const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const config = require('./env');

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Creates an instance of ChatGoogleGenerativeAI configured with Gemini.
 * Reads configuration from environment variables and config schema.
 *
 * Environment variables:
 * - GEMINI_API_KEY: Google Gemini API key
 * - LLM_MODEL: Model identifier (defaults to 'gemini-2.5-flash')
 * - LLM_TEMPERATURE: Generation temperature (defaults to 0.7)
 *
 * @param {Object} [overrides={}] - Optional configuration overrides (model, temperature, apiKey, etc.)
 * @returns {ChatGoogleGenerativeAI} Initialized LangChain ChatGoogleGenerativeAI instance
 */
function createLLM(overrides = {}) {
  const apiKey =
    overrides.apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    config.ai?.geminiApiKey;

  const model =
    overrides.model ||
    overrides.modelName ||
    process.env.LLM_MODEL ||
    config.ai?.model ||
    DEFAULT_MODEL;

  const rawTemp =
    overrides.temperature !== undefined
      ? overrides.temperature
      : process.env.LLM_TEMPERATURE !== undefined
      ? process.env.LLM_TEMPERATURE
      : config.ai?.temperature;

  const temperature =
    rawTemp !== undefined && rawTemp !== null && !isNaN(Number(rawTemp))
      ? Number(rawTemp)
      : DEFAULT_TEMPERATURE;

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment to initialize the Gemini LLM client.'
    );
  }

  return new ChatGoogleGenerativeAI({
    apiKey,
    model,
    temperature,
    ...overrides,
  });
}

// Cached singleton instance
let defaultLLMInstance = null;

/**
 * Returns a cached singleton instance of ChatGoogleGenerativeAI,
 * or creates a custom instance when overrides are supplied.
 *
 * @param {Object} [overrides]
 * @returns {ChatGoogleGenerativeAI}
 */
function getLLM(overrides) {
  if (overrides && Object.keys(overrides).length > 0) {
    return createLLM(overrides);
  }
  if (!defaultLLMInstance) {
    defaultLLMInstance = createLLM();
  }
  return defaultLLMInstance;
}

module.exports = {
  createLLM,
  getLLM,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  // Lazy accessor for standard singleton instance
  get llm() {
    return getLLM();
  },
};
