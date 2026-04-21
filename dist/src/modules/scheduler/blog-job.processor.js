"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let BlogJobProcessor = class BlogJobProcessor extends bullmq_1.WorkerHost {
    blogGenerator;
    imageGenerator;
    strapiService;
    prisma;
    configService;
    logger;
    constructor(blogGenerator, imageGenerator, strapiService, prisma, configService, logger) {
        super();
        this.blogGenerator = blogGenerator;
        this.imageGenerator = imageGenerator;
        this.strapiService = strapiService;
        this.prisma = prisma;
        this.configService = configService;
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
            const categoriesList = await this.strapiService.fetchCategories();
            const categoryNames = categoriesList.map((c) => c.name);
            const blog = await this.blogGenerator.generateBlog(title, keywords || [], categoryNames);
            const selectedCategory = categoriesList.find((c) => c.name.toLowerCase() === blog.category?.toLowerCase());
            const categoryId = selectedCategory ? selectedCategory.id : 1;
            this.logger.info(`BlogJob [${job.id}]: Selected Category — "${blog.category}" (ID: ${categoryId})`);
            await job.updateProgress(40);
            this.logger.info(`BlogJob [${job.id}]: Content generated — "${blog.seoTitle}"`);
            this.logger.info(`BlogJob [${job.id}]: Step 2/4 — Generating banner image...`);
            const imageBuffer = await this.imageGenerator.generateBannerImage(blog.seoTitle);
            await job.updateProgress(60);
            this.logger.info(`BlogJob [${job.id}]: Banner image generated`);
            const isBypass = this.configService.get('BYPASS_STRAPI') || false;
            if (isBypass) {
                const previewDir = path.join(process.cwd(), 'previews');
                if (!fs.existsSync(previewDir)) {
                    fs.mkdirSync(previewDir, { recursive: true });
                }
                const contentPath = path.join(previewDir, `${blog.slug}.md`);
                fs.writeFileSync(contentPath, blog.content);
                const imagePath = path.join(previewDir, `${blog.slug}-banner.jpg`);
                fs.writeFileSync(imagePath, imageBuffer);
                this.logger.info(`📸 PREVIEW SAVED: file:///${contentPath.replace(/\\/g, '/')}`);
                this.logger.info(`🖼️ BANNER SAVED: file:///${imagePath.replace(/\\/g, '/')}`);
            }
            this.logger.info(`BlogJob [${job.id}]: Step 3/4 — Uploading image to Strapi...`);
            const imageFilename = `${slug}-banner.jpg`;
            const mediaId = await this.strapiService.uploadImage(imageBuffer, imageFilename);
            await job.updateProgress(80);
            this.logger.info(`BlogJob [${job.id}]: Image uploaded — Media ID: ${mediaId}`);
            this.logger.info(`BlogJob [${job.id}]: Step 4/4 — Publishing article...`);
            const authors = await this.strapiService.fetchAuthors();
            const randomAuthor = authors.length > 0
                ? authors[Math.floor(Math.random() * authors.length)]
                : { id: 2, name: 'Nikhil Chauhan' };
            this.logger.info(`BlogJob [${job.id}]: Selected author — "${randomAuthor.name}" (ID: ${randomAuthor.id})`);
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
                authorId: randomAuthor.id,
                authorName: randomAuthor.name,
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
    __param(5, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [blog_generator_service_1.BlogGeneratorService,
        image_generator_service_1.ImageGeneratorService,
        strapi_service_1.StrapiService,
        prisma_service_1.PrismaService,
        config_1.ConfigService,
        winston_1.Logger])
], BlogJobProcessor);
//# sourceMappingURL=blog-job.processor.js.map