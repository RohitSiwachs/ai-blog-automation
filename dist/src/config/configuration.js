"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    strapi: {
        baseUrl: process.env.STRAPI_BASE_URL || 'http://localhost:1337',
        apiToken: process.env.STRAPI_API_TOKEN || '',
        siteUrl: process.env.BLOG_SITE_URL || 'https://blog.innovaft.com',
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    database: {
        url: process.env.DATABASE_URL || '',
    },
    scheduler: {
        dailyCron: process.env.DAILY_CRON || '0 6 * * *',
        postsPerDay: parseInt(process.env.POSTS_PER_DAY || '5', 10),
    },
    brand: {
        name: process.env.BRAND_NAME || 'TechBlog',
    },
});
//# sourceMappingURL=configuration.js.map