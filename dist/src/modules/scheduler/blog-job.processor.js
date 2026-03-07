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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlogJobProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const prisma_service_1 = require("../../prisma/prisma.service");
const blog_generator_service_1 = require("../blog-generator/blog-generator.service");
const image_generator_service_1 = require("../image-generator/image-generator.service");
const strapi_service_1 = require("../strapi-service/strapi.service");
let BlogJobProcessor = class BlogJobProcessor extends bullmq_1.WorkerHost {
    blogGenerator;
    imageGenerator;
    strapiService;
    prisma;
    logger;
    constructor(blogGenerator, imageGenerator, strapiService, prisma, logger) {
        super();
        this.blogGenerator = blogGenerator;
        this.imageGenerator = imageGenerator;
        this.strapiService = strapiService;
        this.prisma = prisma;
        this.logger = logger;
    }
    async process(job) {
        const { title, slug, keywords, blogLogId } = job.data;
        this.logger.info(`🚀 BlogJob [${job.id}]: Starting processing — "${title}"`);
        try {
            await this.updateBlogLog(blogLogId, {
                status: 'generating',
                attempts: job.attemptsMade + 1,
            });
            await job.updateProgress(10);
            this.logger.info(`BlogJob [${job.id}]: Step 1/4 — Generating content...`);
            const blog = await this.blogGenerator.generateBlog(title, keywords);
            await job.updateProgress(40);
            this.logger.info(`BlogJob [${job.id}]: Content generated — "${blog.seoTitle}"`);
            this.logger.info(`BlogJob [${job.id}]: Step 2/4 — Generating banner image...`);
            const imageBuffer = await this.imageGenerator.generateBannerImage(blog.seoTitle);
            await job.updateProgress(60);
            this.logger.info(`BlogJob [${job.id}]: Banner image generated`);
            this.logger.info(`BlogJob [${job.id}]: Step 3/4 — Uploading image to Strapi...`);
            const imageFilename = `${slug}-banner.jpg`;
            const mediaId = await this.strapiService.uploadImage(imageBuffer, imageFilename);
            await job.updateProgress(80);
            this.logger.info(`BlogJob [${job.id}]: Image uploaded — Media ID: ${mediaId}`);
            this.logger.info(`BlogJob [${job.id}]: Step 4/4 — Publishing article...`);
            const designClusters = ['design', 'ui-ux', 'designing'];
            const categoryId = designClusters.includes(job.data.cluster?.toLowerCase())
                ? 2
                : 1;
            const strapiId = await this.strapiService.createBlogPost({
                title: blog.seoTitle,
                description: blog.description,
                slug: blog.slug,
                content: blog.content,
                metaTitle: blog.seoTitle,
                metaDescription: blog.metaDescription,
                ogTitle: blog.ogTitle,
                ogDescription: blog.ogDescription,
                metaKeywords: blog.metaKeywords,
                keywords: job.data.keywords || [],
                tags: blog.tags,
                cover: mediaId,
                authorId: 2,
                categoryId,
            });
            await job.updateProgress(100);
            await this.updateBlogLog(blogLogId, {
                status: 'published',
                strapiId,
                imageId: mediaId,
                title: blog.seoTitle,
                slug: blog.slug,
            });
            this.logger.info(`✅ BlogJob [${job.id}]: Successfully published — ` +
                `Strapi ID: ${strapiId}, slug: "${blog.slug}"`);
        }
        catch (error) {
            this.logger.error(`❌ BlogJob [${job.id}]: Failed — ${error.message}`);
            await this.updateBlogLog(blogLogId, {
                status: 'failed',
                error: error.message,
                attempts: job.attemptsMade + 1,
            });
            throw error;
        }
    }
    async updateBlogLog(id, data) {
        try {
            await this.prisma.blogLog.update({
                where: { id },
                data,
            });
        }
        catch (error) {
            this.logger.warn(`BlogJob: Failed to update BlogLog ${id} — ${error.message}`);
        }
    }
};
exports.BlogJobProcessor = BlogJobProcessor;
exports.BlogJobProcessor = BlogJobProcessor = __decorate([
    (0, bullmq_1.Processor)('blog-generation', {
        concurrency: 1,
    }),
    __param(4, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [blog_generator_service_1.BlogGeneratorService,
        image_generator_service_1.ImageGeneratorService,
        strapi_service_1.StrapiService,
        prisma_service_1.PrismaService,
        winston_1.Logger])
], BlogJobProcessor);
//# sourceMappingURL=blog-job.processor.js.map