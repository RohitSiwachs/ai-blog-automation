import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Logger } from 'winston';
import { PrismaService } from '../../prisma/prisma.service';
import { TopicEngineService } from '../topic-engine/topic-engine.service';
import { BlogGeneratorService } from '../blog-generator/blog-generator.service';
import { ImageGeneratorService } from '../image-generator/image-generator.service';
import { StrapiService } from '../strapi-service/strapi.service';
import { BlogJobData } from './blog-job.processor';
export declare class SchedulerService implements OnModuleInit {
    private readonly blogQueue;
    private readonly topicEngine;
    private readonly blogGenerator;
    private readonly imageGenerator;
    private readonly strapiService;
    private readonly prisma;
    private readonly configService;
    private readonly logger;
    private postsPerDay;
    private redisEnabled;
    constructor(blogQueue: Queue<BlogJobData>, topicEngine: TopicEngineService, blogGenerator: BlogGeneratorService, imageGenerator: ImageGeneratorService, strapiService: StrapiService, prisma: PrismaService, configService: ConfigService, logger: Logger);
    onModuleInit(): Promise<void>;
    handleDailyBatch(): Promise<void>;
    scheduleDailyBatch(): Promise<void>;
    private enqueueJobs;
    private runJobsDirectly;
    triggerManualBatch(count?: number): Promise<{
        message: string;
        jobCount: number;
    }>;
}
