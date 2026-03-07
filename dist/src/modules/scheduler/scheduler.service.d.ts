import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Logger } from 'winston';
import { PrismaService } from '../../prisma/prisma.service';
import { TopicEngineService } from '../topic-engine/topic-engine.service';
import { BlogJobData } from './blog-job.processor';
export declare class SchedulerService implements OnModuleInit {
    private readonly blogQueue;
    private readonly topicEngine;
    private readonly prisma;
    private readonly configService;
    private readonly logger;
    private postsPerDay;
    constructor(blogQueue: Queue<BlogJobData>, topicEngine: TopicEngineService, prisma: PrismaService, configService: ConfigService, logger: Logger);
    onModuleInit(): Promise<void>;
    handleDailyBatch(): Promise<void>;
    scheduleDailyBatch(): Promise<void>;
    triggerManualBatch(count?: number): Promise<{
        message: string;
        jobCount: number;
    }>;
}
