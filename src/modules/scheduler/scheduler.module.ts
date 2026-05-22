// ============================================================
// Scheduler Module
// Wires together BullMQ queue, cron scheduling, and the
// blog job processor. Supports direct mode when Redis is off.
// ============================================================

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulerService } from './scheduler.service';
import { BlogJobProcessor } from './blog-job.processor';
import { TopicEngineModule } from '../topic-engine/topic-engine.module';
import { BlogGeneratorModule } from '../blog-generator/blog-generator.module';
import { ImageGeneratorModule } from '../image-generator/image-generator.module';
import { StrapiModule } from '../strapi-service/strapi.module';

@Module({
  imports: [
    // Register the blog-generation queue
    BullModule.registerQueue({
      name: 'blog-generation',
    }),

    // Import dependent modules
    TopicEngineModule,
    BlogGeneratorModule,
    ImageGeneratorModule,
    StrapiModule,
  ],
  providers: [SchedulerService, BlogJobProcessor],
  exports: [SchedulerService],
})
export class SchedulerModule {}
