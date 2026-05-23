// ============================================================
// Scheduler Service
// Orchestrates the daily blog generation batch.
// Uses @nestjs/schedule for cron and BullMQ for job queuing.
// Supports DIRECT MODE when Redis is unavailable.
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
import { BlogGeneratorService } from '../blog-generator/blog-generator.service';
import { ImageGeneratorService } from '../image-generator/image-generator.service';
import { StrapiService } from '../strapi-service/strapi.service';
import { BlogJobData } from './blog-job.processor';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private postsPerDay: number;
  private redisEnabled: boolean;

  constructor(
    @InjectQueue('blog-generation')
    private readonly blogQueue: Queue<BlogJobData>,
    private readonly topicEngine: TopicEngineService,
    private readonly blogGenerator: BlogGeneratorService,
    private readonly imageGenerator: ImageGeneratorService,
    private readonly strapiService: StrapiService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.postsPerDay =
      this.configService.get<number>('scheduler.postsPerDay') || 5;
    this.redisEnabled = this.configService.get<string>('redis.enabled') !== 'false';
  }

  /**
   * Log scheduler readiness on module init.
   */
  async onModuleInit(): Promise<void> {
    const cron = this.configService.get<string>('scheduler.dailyCron');
    this.logger.info(
      `📅 Scheduler: Initialized — Cron: "${cron}", Posts/day: ${this.postsPerDay}, Redis: ${this.redisEnabled ? 'ENABLED' : 'DISABLED (Direct Mode)'}`,
    );

    if (!this.redisEnabled) {
      this.logger.warn('⚠️  Scheduler: Redis disabled — using DIRECT MODE (no queue, jobs run synchronously).');
    }

    this.logger.info('📅 Scheduler: Waiting for next scheduled run...');
  }

  /**
   * Daily cron job — runs at the configured time.
   * Default: Everyday at 7:00 AM (Asia/Kolkata).
   */
  @Cron('0 7 * * *', { name: 'daily-blog-batch', timeZone: 'Asia/Kolkata' })
  async handleDailyBatch(): Promise<void> {
    await this.scheduleDailyBatch();
  }

  /**
   * Core batch scheduling logic.
   * If Redis is enabled, uses BullMQ queue.
   * If Redis is disabled, runs jobs DIRECTLY (synchronously).
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
        `Scheduler: Generated ${topics.length} topics. Mode: ${this.redisEnabled ? 'QUEUE' : 'DIRECT'}`,
      );

      if (this.redisEnabled) {
        // ===== QUEUE MODE: Enqueue jobs via BullMQ =====
        await this.enqueueJobs(topics);
      } else {
        // ===== DIRECT MODE: Run jobs synchronously =====
        await this.runJobsDirectly(topics);
      }
    } catch (error) {
      this.logger.error(`❌ Scheduler: Batch failed — ${error.message}`, {
        stack: error.stack,
      });
    }
  }

  /**
   * QUEUE MODE: Enqueue jobs to BullMQ (requires Redis).
   */
  private async enqueueJobs(topics: any[]): Promise<void> {
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
        },
      );

      this.logger.info(
        `Scheduler: Enqueued job ${job.id} — "${topic.title}" [delay: ${i * 60}s]`,
      );
    }

    this.logger.info(
      `✅ Scheduler: Batch complete — ${topics.length} jobs enqueued`,
    );
  }

  /**
   * DIRECT MODE: Run the full blog generation pipeline synchronously.
   * Used when Redis is unavailable (Upstash limit, local dev, etc.)
   */
  private async runJobsDirectly(topics: any[]): Promise<void> {
    this.logger.info(`🔧 Scheduler: DIRECT MODE — Processing ${topics.length} topics synchronously...`);

    const isBypass = this.configService.get<boolean>('BYPASS_STRAPI') || false;

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      this.logger.info(`\n🚀 Direct [${i + 1}/${topics.length}]: Starting — "${topic.title}"`);

      try {
        // Create BlogLog entry
        const blogLog = await this.prisma.blogLog.create({
          data: {
            topicId: i + 1,
            title: topic.title,
            slug: topic.slug,
            status: 'generating',
          },
        });

        // Step 1: Generate blog content
        this.logger.info(`Direct [${i + 1}]: Step 1/4 — Generating content...`);
        const categoriesList = await this.strapiService.fetchCategories();
        const categoryNames = categoriesList.map((c) => c.name);

        const blog = await this.blogGenerator.generateBlog(
          topic.title,
          topic.keywords || [],
          categoryNames,
        );

        const selectedCategory = categoriesList.find(
          (c) => c.name.toLowerCase() === blog.category?.toLowerCase(),
        );
        const categoryId = selectedCategory ? selectedCategory.id : 1;

        this.logger.info(`Direct [${i + 1}]: Content generated — "${blog.seoTitle}"`);

        // Step 2: Generate banner image
        this.logger.info(`Direct [${i + 1}]: Step 2/4 — Generating banner image...`);
        const imageBuffer = await this.imageGenerator.generateBannerImage(blog.seoTitle);
        this.logger.info(`Direct [${i + 1}]: Banner image generated`);

        // Save local preview if bypass mode
        if (isBypass) {
          const previewDir = path.join(process.cwd(), 'previews');
          if (!fs.existsSync(previewDir)) {
            fs.mkdirSync(previewDir, { recursive: true });
          }
          fs.writeFileSync(path.join(previewDir, `${blog.slug}.md`), blog.content);
          fs.writeFileSync(path.join(previewDir, `${blog.slug}-banner.jpg`), imageBuffer);
          this.logger.info(`Direct [${i + 1}]: Preview saved locally`);
        }

        // Step 3: Upload image to Strapi
        this.logger.info(`Direct [${i + 1}]: Step 3/4 — Uploading image to Strapi...`);
        const imageFilename = `${topic.slug}-banner.jpg`;
        const mediaId = await this.strapiService.uploadImage(imageBuffer, imageFilename);
        this.logger.info(`Direct [${i + 1}]: Image uploaded — Media ID: ${mediaId}`);

        // Step 4: Create article in Strapi
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

        // Update BlogLog as published
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

        this.logger.info(
          `✅ Direct [${i + 1}]: Published — Strapi ID: ${strapiId}, slug: "${blog.slug}"`,
        );
      } catch (error) {
        this.logger.error(`❌ Direct [${i + 1}]: Failed — "${topic.title}" — ${error.message}`);
      }

      // Small delay between jobs to avoid API rate limits
      if (i < topics.length - 1) {
        this.logger.info(`Direct: Waiting 30s before next job...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    this.logger.info(`✅ Scheduler: DIRECT MODE batch complete`);
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
        message: `Manual batch triggered: ${this.postsPerDay} posts ${this.redisEnabled ? 'enqueued' : 'processed directly'}`,
        jobCount: this.postsPerDay,
      };
    } finally {
      this.postsPerDay = originalCount;
    }
  }
}
