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
  },

  // --- Google Gemini AI ---
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
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
