const path = require('path');
const Joi = require('joi');

// Load environment variables from server/.env relative to __dirname, then fallback to current working directory
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

// Define validation for all environment variables
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),

  // Database Configuration (optional for now until Phase 9)
  MONGODB_URI: Joi.string().description('MongoDB connection string'),

  // Auth Secrets (optional until Epic B is complete)
  JWT_SECRET: Joi.string().description('JWT Secret Key for access tokens'),
  JWT_EXPIRES_IN: Joi.string().default('7d').description('JWT Expiry duration'),
  JWT_REFRESH_SECRET: Joi.string().description('JWT Refresh Secret Key'),

  // AI Configuration (Epic F - Gemini)
  GEMINI_API_KEY: Joi.string().allow('').description('Google Gemini API Key for LangChain/LangGraph'),
  ANTHROPIC_API_KEY: Joi.string().allow('').description('Anthropic API Key for legacy/optional support'),
  LLM_MODEL: Joi.string().default('gemini-2.5-flash').description('Default LLM Model'),
  LLM_TEMPERATURE: Joi.number().default(0.7).description('LLM Temperature setting'),

  // Cloudinary Storage Configuration
  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').description('Cloudinary Cloud Name'),
  CLOUDINARY_API_KEY: Joi.string().allow('').description('Cloudinary API Key'),
  CLOUDINARY_API_SECRET: Joi.string().allow('').description('Cloudinary API Secret'),
  CLOUDINARY_URL: Joi.string().allow('').description('Cloudinary URL Connection String'),

  // Security & Rate Limiting
  CORS_ORIGIN: Joi.string()
    .default('http://localhost:5173,http://localhost:3000,http://localhost:4173')
    .description('Allowed CORS origins, comma-separated'),
  RATE_LIMIT_MAX: Joi.number().default(100).description('Max requests per 15 min per IP for API'),
}).unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongoose: {
    url: envVars.MONGODB_URI,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpiration: envVars.JWT_EXPIRES_IN,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
  },
  ai: {
    geminiApiKey: envVars.GEMINI_API_KEY,
    anthropicApiKey: envVars.ANTHROPIC_API_KEY,
    model: envVars.LLM_MODEL,
    temperature: envVars.LLM_TEMPERATURE,
  },
  cloudinary: {
    cloudName: envVars.CLOUDINARY_CLOUD_NAME,
    apiKey: envVars.CLOUDINARY_API_KEY,
    apiSecret: envVars.CLOUDINARY_API_SECRET,
    url: envVars.CLOUDINARY_URL,
  },
  corsOrigins: (envVars.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimitMax: envVars.RATE_LIMIT_MAX,
};
