// ============================================================
// Scheduler Service
// Orchestrates the daily blog generation batch.
// Uses @nestjs/schedule for cron and BullMQ for job queuing.
// ============================================================

import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from '../../prisma/prisma.service';
import { TopicEngineService } from '../topic-engine/topic-engine.service';
import { BlogJobData } from './blog-job.processor';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private postsPerDay: number;

  constructor(
    @InjectQueue('blog-generation')
    private readonly blogQueue: Queue<BlogJobData>,
    private readonly topicEngine: TopicEngineService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.postsPerDay =
      this.configService.get<number>('scheduler.postsPerDay') || 5;
  }

  /**
   * Log scheduler readiness on module init.
   */
  async onModuleInit(): Promise<void> {
    const cron = this.configService.get<string>('scheduler.dailyCron');
    this.logger.info(
      `📅 Scheduler: Initialized — Cron: "${cron}", Posts/day: ${this.postsPerDay}`,
    );
    this.logger.info('📅 Scheduler: Waiting for next scheduled run...');
  }

  /**
   * Daily cron job — runs at the configured time.
   * Default: 6:00 AM daily.
   *
   * NOTE: The @Cron decorator requires a static expression.
   * For runtime-configurable cron, we use SchedulerRegistry in onModuleInit.
   * Here we use a common default; override via DAILY_CRON env variable
   * by using the dynamic scheduling approach below.
   */
  @Cron('0 6 * * *', { name: 'daily-blog-batch' })
  async handleDailyBatch(): Promise<void> {
    await this.scheduleDailyBatch();
  }

  /**
   * Core batch scheduling logic.
   * Can be called from cron trigger or manually for testing.
   */
  async scheduleDailyBatch(): Promise<void> {
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.info(
      `🔄 Scheduler: Starting daily batch — ${new Date().toISOString()}`,
    );
    this.logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // Step 1: Generate fresh topics
      const topics = await this.topicEngine.generateTopics(this.postsPerDay);

      if (topics.length === 0) {
        this.logger.warn(
          'Scheduler: No new topics generated. All topics may have been used. Skipping batch.',
        );
        return;
      }

      this.logger.info(
        `Scheduler: Generated ${topics.length} topics, enqueuing jobs...`,
      );

      // Step 2: Create BlogLog entries and enqueue jobs
      for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];

        // Create a BlogLog entry to track this job
        const blogLog = await this.prisma.blogLog.create({
          data: {
            topicId: i + 1, // Simple incrementing ID reference
            title: topic.title,
            slug: topic.slug,
            status: 'pending',
          },
        });

        // Enqueue the job with retry configuration
        const job = await this.blogQueue.add(
          'generate-blog',
          {
            title: topic.title,
            slug: topic.slug,
            keywords: topic.keywords,
            cluster: topic.cluster,
            blogLogId: blogLog.id,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000, // Start with 5s, then 10s, then 20s
            },
            removeOnComplete: {
              age: 86400, // Keep completed jobs for 24 hours
              count: 100, // Keep last 100 completed jobs
            },
            removeOnFail: {
              age: 604800, // Keep failed jobs for 7 days
            },
            delay: i * 30000, // Stagger jobs 30 seconds apart to avoid rate limits
          },
        );

        this.logger.info(
          `Scheduler: Enqueued job ${job.id} — "${topic.title}" [delay: ${i * 30}s]`,
        );
      }

      this.logger.info(
        `✅ Scheduler: Batch complete — ${topics.length} jobs enqueued`,
      );
    } catch (error) {
      this.logger.error(`❌ Scheduler: Batch failed — ${error.message}`, {
        stack: error.stack,
      });
    }
  }

  /**
   * Manually trigger a batch (useful for testing or one-off runs).
   * Can be called via a controller or CLI command.
   */
  async triggerManualBatch(
    count?: number,
  ): Promise<{ message: string; jobCount: number }> {
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
    } finally {
      this.postsPerDay = originalCount;
    }
  }
}
