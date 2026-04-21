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
let SchedulerService = class SchedulerService {
    blogQueue;
    topicEngine;
    prisma;
    configService;
    logger;
    postsPerDay;
    constructor(blogQueue, topicEngine, prisma, configService, logger) {
        this.blogQueue = blogQueue;
        this.topicEngine = topicEngine;
        this.prisma = prisma;
        this.configService = configService;
        this.logger = logger;
        this.postsPerDay =
            this.configService.get('scheduler.postsPerDay') || 5;
    }
    async onModuleInit() {
        const cron = this.configService.get('scheduler.dailyCron');
        this.logger.info(`📅 Scheduler: Initialized — Cron: "${cron}", Posts/day: ${this.postsPerDay}`);
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
            this.logger.info(`Scheduler: Generated ${topics.length} topics, enqueuing jobs...`);
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
        catch (error) {
            this.logger.error(`❌ Scheduler: Batch failed — ${error.message}`, {
                stack: error.stack,
            });
        }
    }
    async triggerManualBatch(count) {
        const originalCount = this.postsPerDay;
        if (count) {
            this.postsPerDay = count;
        }
        try {
            await this.scheduleDailyBatch();
            return {
                message: `Manual batch triggered: ${this.postsPerDay} posts scheduled`,
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
    (0, schedule_1.Cron)('0 7 * * *', { name: 'daily-blog-batch' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "handleDailyBatch", null);
exports.SchedulerService = SchedulerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('blog-generation')),
    __param(4, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [bullmq_2.Queue,
        topic_engine_service_1.TopicEngineService,
        prisma_service_1.PrismaService,
        config_1.ConfigService,
        winston_1.Logger])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map