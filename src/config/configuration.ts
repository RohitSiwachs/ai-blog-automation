// ============================================================
// Configuration Factory
// Provides typed, validated access to all environment variables.
// ============================================================

export default () => ({
  // --- Strapi CMS ---
  strapi: {
    baseUrl: process.env.STRAPI_BASE_URL || 'http://localhost:1337',
    apiToken: process.env.STRAPI_API_TOKEN || '',
    siteUrl: process.env.BLOG_SITE_URL || 'https://blog.innovaft.com',
    bypassMode: process.env.BYPASS_STRAPI === 'true',
  },

  // --- AI Provider ---
  aiProvider: process.env.AI_PROVIDER || 'gemini',

  // --- Google Gemini AI ---
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  },

  // --- NVIDIA NIM ---
  nvidia: {
    apiKey: process.env.NVIDIA_API_KEY || '',
    imageApiKey: process.env.NVIDIA_IMAGE_API_KEY || process.env.NVIDIA_API_KEY || '',
    model: process.env.NVIDIA_MODEL || 'google/gemma-3-27b-it',
    chatEndpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    imageEndpoint: 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell',
  },

  // --- Redis ---
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  // --- Database ---
  database: {
    url: process.env.DATABASE_URL || '',
  },

  // --- Scheduler ---
  scheduler: {
    dailyCron: process.env.DAILY_CRON || '0 6 * * *',
    postsPerDay: parseInt(process.env.POSTS_PER_DAY || '5', 10),
  },

  // --- Branding ---
  brand: {
    name: process.env.BRAND_NAME || 'TechBlog',
  },
});
