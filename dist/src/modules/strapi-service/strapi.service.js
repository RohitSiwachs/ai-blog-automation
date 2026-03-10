"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrapiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const slugify_1 = __importDefault(require("slugify"));
let StrapiService = class StrapiService {
    configService;
    logger;
    client;
    maxRetries = 3;
    retryBaseDelay = 1000;
    siteUrl;
    constructor(configService, logger) {
        this.configService = configService;
        this.logger = logger;
        const baseUrl = this.configService.get('strapi.baseUrl');
        const apiToken = this.configService.get('strapi.apiToken');
        this.siteUrl =
            this.configService.get('strapi.siteUrl') ||
                'https://blog.innovaft.com';
        this.client = axios_1.default.create({
            baseURL: baseUrl,
            headers: {
                Authorization: `Bearer ${apiToken}`,
            },
            timeout: 30000,
        });
        this.logger.info(`StrapiService: Initialized with base URL — ${baseUrl}`);
    }
    async uploadImage(buffer, filename) {
        this.logger.info(`Strapi: Uploading image "${filename}"...`);
        return this.withRetry(async () => {
            const formData = new form_data_1.default();
            formData.append('files', buffer, {
                filename,
                contentType: 'image/jpeg',
            });
            const response = await this.client.post('/api/upload', formData, {
                headers: { ...formData.getHeaders() },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });
            const mediaId = response.data[0].id;
            this.logger.info(`Strapi: Image uploaded successfully — ID: ${mediaId}, filename: "${filename}"`);
            return mediaId;
        }, 'uploadImage');
    }
    async createBlogPost(data) {
        this.logger.info(`Strapi: Creating article "${data.title}"...`);
        return this.withRetry(async () => {
            const canonicalSlug = (0, slugify_1.default)(data.metaTitle, {
                lower: true,
                strict: true,
                trim: true,
            });
            const now = new Date().toISOString();
            const structuredData = {
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: data.metaTitle,
                description: data.metaDescription,
                keywords: data.keywords,
                image: data.cover
                    ? `${this.siteUrl}/cover-image`
                    : `${this.siteUrl}/images/default-cover.jpg`,
                author: {
                    '@type': 'Person',
                    name: data.authorName || 'Innovaft Team',
                },
                publisher: {
                    '@type': 'Organization',
                    name: 'Innovaft',
                    logo: {
                        '@type': 'ImageObject',
                        url: `${this.siteUrl}/logo.png`,
                    },
                },
                datePublished: now,
                dateModified: now,
                mainEntityOfPage: {
                    '@type': 'WebPage',
                    '@id': `${this.siteUrl}/articles/${canonicalSlug}`,
                },
                articleSection: 'Technology',
            };
            const payload = {
                data: {
                    title: data.title,
                    description: data.description,
                    blocks: [
                        {
                            __component: 'shared.rich-text',
                            body: data.content,
                        },
                    ],
                    author: { connect: [{ id: data.authorId }] },
                    category: { connect: [{ id: data.categoryId }] },
                    tags: data.tags.slice(0, 2).map((tag) => ({ tag })),
                    seo: {
                        metaTitle: data.metaTitle,
                        metaDescription: data.metaDescription,
                        metaKeywords: data.metaKeywords,
                        canonicalUrl: `${this.siteUrl}/${canonicalSlug}`,
                        metaRobots: 'index, follow',
                        ogTitle: data.ogTitle,
                        ogDescription: data.ogDescription,
                        structuredData,
                        ...(data.cover && { ogImage: data.cover }),
                    },
                },
            };
            payload.data.slug = data.slug;
            if (data.cover) {
                payload.data.cover = data.cover;
            }
            const response = await this.client.post('/api/articles?status=published', payload);
            const articleId = response.data.data.id;
            this.logger.info(`Strapi: Article created successfully — ID: ${articleId}, slug: "${data.slug}"`);
            return articleId;
        }, 'createBlogPost');
    }
    async fetchAuthors() {
        this.logger.info(`Strapi: Fetching authors...`);
        return this.withRetry(async () => {
            const response = await this.client.get('/api/authors');
            const authors = (response.data.data || []).map((entry) => ({
                id: entry.id,
                name: entry.name || 'Unknown Author',
            }));
            this.logger.info(`Strapi: Fetched ${authors.length} authors`);
            return authors;
        }, 'fetchAuthors');
    }
    async fetchCategories() {
        this.logger.info(`Strapi: Fetching categories...`);
        return this.withRetry(async () => {
            const response = await this.client.get('/api/categories');
            const categories = (response.data.data || []).map((entry) => ({
                id: entry.id,
                name: entry.name || 'Unknown Category',
            }));
            this.logger.info(`Strapi: Fetched ${categories.length} categories`);
            return categories;
        }, 'fetchCategories');
    }
    async fetchRecentBlogs(limit = 50) {
        this.logger.info(`Strapi: Fetching last ${limit} articles...`);
        return this.withRetry(async () => {
            const response = await this.client.get('/api/articles', {
                params: {
                    'pagination[limit]': limit,
                    'sort[0]': 'createdAt:desc',
                },
            });
            const articles = (response.data.data || []).map((entry) => ({
                id: entry.id,
                title: entry.title || '',
                slug: entry.slug || '',
                createdAt: entry.createdAt || '',
            }));
            this.logger.info(`Strapi: Fetched ${articles.length} recent articles`);
            return articles;
        }, 'fetchRecentBlogs');
    }
    async withRetry(operation, operationName) {
        let lastError = new Error('All retry attempts failed');
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                const axiosError = error;
                const statusCode = axiosError.response?.status;
                const errorMessage = axiosError.message;
                this.logger.warn(`Strapi: ${operationName} failed (attempt ${attempt}/${this.maxRetries}) — ` +
                    `Status: ${statusCode || 'N/A'}, Error: ${errorMessage}`);
                if (statusCode &&
                    statusCode >= 400 &&
                    statusCode < 500 &&
                    statusCode !== 429) {
                    this.logger.error(`Strapi: ${operationName} — Client error ${statusCode}, not retrying`);
                    throw error;
                }
                if (attempt < this.maxRetries) {
                    const delay = this.retryBaseDelay * Math.pow(2, attempt - 1);
                    this.logger.info(`Strapi: Retrying ${operationName} in ${delay}ms...`);
                    await this.sleep(delay);
                }
            }
        }
        this.logger.error(`Strapi: ${operationName} — All ${this.maxRetries} attempts exhausted`);
        throw lastError;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.StrapiService = StrapiService;
exports.StrapiService = StrapiService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        winston_1.Logger])
], StrapiService);
//# sourceMappingURL=strapi.service.js.map