"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    strapi: {
        baseUrl: process.env.STRAPI_BASE_URL || 'http://localhost:1337',
        apiToken: process.env.STRAPI_API_TOKEN || '',
        siteUrl: process.env.BLOG_SITE_URL || 'https://blog.innovaft.com',
        bypassMode: process.env.BYPASS_STRAPI === 'true',
    },
    aiProvider: process.env.AI_PROVIDER || 'gemini',
    gemini: {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    },
    nvidia: {
        apiKey: process.env.NVIDIA_API_KEY || '',
        imageApiKey: process.env.NVIDIA_IMAGE_API_KEY || process.env.NVIDIA_API_KEY || '',
        model: process.env.NVIDIA_MODEL || 'google/gemma-3-27b-it',
        chatEndpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
        imageEndpoint: 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell',
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_TLS === 'true',
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