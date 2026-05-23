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
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const prisma_service_1 = require("../../prisma/prisma.service");
const topic_engine_service_1 = require("../topic-engine/topic-engine.service");
const blog_generator_service_1 = require("../blog-generator/blog-generator.service");
const image_generator_service_1 = require("../image-generator/image-generator.service");
const strapi_service_1 = require("../strapi-service/strapi.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let SchedulerService = class SchedulerService {
    blogQueue;
    topicEngine;
    blogGenerator;
    imageGenerator;
    strapiService;
    prisma;
    configService;
    logger;
    postsPerDay;
    redisEnabled;
    constructor(blogQueue, topicEngine, blogGenerator, imageGenerator, strapiService, prisma, configService, logger) {
        this.blogQueue = blogQueue;
        this.topicEngine = topicEngine;
        this.blogGenerator = blogGenerator;
        this.imageGenerator = imageGenerator;
        this.strapiService = strapiService;
        this.prisma = prisma;
        this.configService = configService;
        this.logger = logger;
        this.postsPerDay =
            this.configService.get('scheduler.postsPerDay') || 5;
        this.redisEnabled =
            this.configService.get('redis.enabled') !== 'false' &&
                process.env.REDIS_AVAILABLE === 'true';
    }
    async onModuleInit() {
        const cron = this.configService.get('scheduler.dailyCron');
        this.logger.info(`📅 Scheduler: Initialized — Cron: "${cron}", Posts/day: ${this.postsPerDay}, Redis: ${this.redisEnabled ? 'ENABLED' : 'DISABLED (Direct Mode)'}`);
        if (!this.redisEnabled) {
            this.logger.warn('⚠️  Scheduler: Redis disabled — using DIRECT MODE (no queue, jobs run synchronously).');
        }
        this.logger.info('📅 Scheduler: Waiting for next scheduled run...');
    }
    async handleDailyBatch() {
        await this.scheduleDailyBatch();
    }
    async scheduleDailyBatch() {
        this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        this.logger.info(`🔄 Scheduler: Starting daily batch — ${new Date().toISOString()}`);
        this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        try {
            const topics = await this.topicEngine.generateTopics(this.postsPerDay);
            if (topics.length === 0) {
                this.logger.warn('Scheduler: No new topics generated. All topics may have been used. Skipping batch.');
                return;
            }
            this.logger.info(`Scheduler: Generated ${topics.length} topics. Mode: ${this.redisEnabled ? 'QUEUE' : 'DIRECT'}`);
            if (this.redisEnabled) {
                await this.enqueueJobs(topics);
            }
            else {
                await this.runJobsDirectly(topics);
            }
        }
        catch (error) {
            this.logger.error(`❌ Scheduler: Batch failed — ${error.message}`, {
                stack: error.stack,
            });
        }
    }
    async enqueueJobs(topics) {
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            const blogLog = await this.prisma.blogLog.create({
                data: {
                    topicId: i + 1,
                    title: topic.title,
                    slug: topic.slug,
                    status: 'pending',
                },
            });
            const job = await this.blogQueue.add('generate-blog', {
                title: topic.title,
                slug: topic.slug,
                keywords: topic.keywords,
                cluster: topic.cluster,
                blogLogId: blogLog.id,
            }, {
                attempts: 5,
                backoff: {
                    type: 'exponential',
                    delay: 30000,
                },
                removeOnComplete: {
                    age: 86400,
                    count: 100,
                },
                removeOnFail: {
                    age: 604800,
                },
                delay: i * 60000,
            });
            this.logger.info(`Scheduler: Enqueued job ${job.id} — "${topic.title}" [delay: ${i * 60}s]`);
        }
        this.logger.info(`✅ Scheduler: Batch complete — ${topics.length} jobs enqueued`);
    }
    async runJobsDirectly(topics) {
        this.logger.info(`🔧 Scheduler: DIRECT MODE — Processing ${topics.length} topics synchronously...`);
        const isBypass = this.configService.get('BYPASS_STRAPI') || false;
        for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            this.logger.info(`\n🚀 Direct [${i + 1}/${topics.length}]: Starting — "${topic.title}"`);
            try {
                const blogLog = await this.prisma.blogLog.create({
                    data: {
                        topicId: i + 1,
                        title: topic.title,
                        slug: topic.slug,
                        status: 'generating',
                    },
                });
                this.logger.info(`Direct [${i + 1}]: Step 1/4 — Generating content...`);
                const categoriesList = await this.strapiService.fetchCategories();
                const categoryNames = categoriesList.map((c) => c.name);
                const blog = await this.blogGenerator.generateBlog(topic.title, topic.keywords || [], categoryNames);
                const selectedCategory = categoriesList.find((c) => c.name.toLowerCase() === blog.category?.toLowerCase());
                const categoryId = selectedCategory ? selectedCategory.id : 1;
                this.logger.info(`Direct [${i + 1}]: Content generated — "${blog.seoTitle}"`);
                this.logger.info(`Direct [${i + 1}]: Step 2/4 — Generating banner image...`);
                const imageBuffer = await this.imageGenerator.generateBannerImage(blog.seoTitle);
                this.logger.info(`Direct [${i + 1}]: Banner image generated`);
                if (isBypass) {
                    const previewDir = path.join(process.cwd(), 'previews');
                    if (!fs.existsSync(previewDir)) {
                        fs.mkdirSync(previewDir, { recursive: true });
                    }
                    fs.writeFileSync(path.join(previewDir, `${blog.slug}.md`), blog.content);
                    fs.writeFileSync(path.join(previewDir, `${blog.slug}-banner.jpg`), imageBuffer);
                    this.logger.info(`Direct [${i + 1}]: Preview saved locally`);
                }
                this.logger.info(`Direct [${i + 1}]: Step 3/4 — Uploading image to Strapi...`);
                const imageFilename = `${topic.slug}-banner.jpg`;
                const mediaId = await this.strapiService.uploadImage(imageBuffer, imageFilename);
                this.logger.info(`Direct [${i + 1}]: Image uploaded — Media ID: ${mediaId}`);
                this.logger.info(`Direct [${i + 1}]: Step 4/4 — Publishing article...`);
                const authors = await this.strapiService.fetchAuthors();
                const randomAuthor = authors.length > 0
                    ? authors[Math.floor(Math.random() * authors.length)]
                    : { id: 2, name: 'Nikhil Chauhan' };
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
                    keywords: topic.keywords || [],
                    tags: blog.tags,
                    cover: mediaId,
                    authorId: randomAuthor.id,
                    authorName: randomAuthor.name,
                    categoryId,
                });
                await this.prisma.blogLog.update({
                    where: { id: blogLog.id },
                    data: {
                        status: 'published',
                        strapiId,
                        imageId: mediaId,
                        title: blog.seoTitle,
                        slug: blog.slug,
                    },
                });
                this.logger.info(`✅ Direct [${i + 1}]: Published — Strapi ID: ${strapiId}, slug: "${blog.slug}"`);
            }
            catch (error) {
                this.logger.error(`❌ Direct [${i + 1}]: Failed — "${topic.title}" — ${error.message}`);
            }
            if (i < topics.length - 1) {
                this.logger.info(`Direct: Waiting 30s before next job...`);
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        }
        this.logger.info(`✅ Scheduler: DIRECT MODE batch complete`);
    }
    async triggerManualBatch(count) {
        const originalCount = this.postsPerDay;
        if (count) {
            this.postsPerDay = count;
        }
        try {
            await this.scheduleDailyBatch();
            return {
                message: `Manual batch triggered: ${this.postsPerDay} posts ${this.redisEnabled ? 'enqueued' : 'processed directly'}`,
                jobCount: this.postsPerDay,
            };
        }
        finally {
            this.postsPerDay = originalCount;
        }
    }
};
exports.SchedulerService = SchedulerService;
__decorate([
    (0, schedule_1.Cron)('0 7 * * *', { name: 'daily-blog-batch', timeZone: 'Asia/Kolkata' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "handleDailyBatch", null);
exports.SchedulerService = SchedulerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('blog-generation')),
    __param(7, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        topic_engine_service_1.TopicEngineService,
        blog_generator_service_1.BlogGeneratorService,
        image_generator_service_1.ImageGeneratorService,
        strapi_service_1.StrapiService,
        prisma_service_1.PrismaService,
        config_1.ConfigService,
        winston_1.Logger])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map