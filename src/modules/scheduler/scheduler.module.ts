// ============================================================
// Scheduler Module
// Wires together BullMQ queue, cron scheduling, and the
// blog job processor. Supports direct mode when Redis is off.
// ============================================================

import { Module } from '@nestjs/common';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { SchedulerService } from './scheduler.service';
import { BlogJobProcessor } from './blog-job.processor';
import { TopicEngineModule } from '../topic-engine/topic-engine.module';
import { BlogGeneratorModule } from '../blog-generator/blog-generator.module';
import { ImageGeneratorModule } from '../image-generator/image-generator.module';
import { StrapiModule } from '../strapi-service/strapi.module';

const redisEnabled = process.env.REDIS_ENABLED !== 'false' && process.env.REDIS_AVAILABLE === 'true';

const imports: any[] = [
  // Import dependent modules
  TopicEngineModule,
  BlogGeneratorModule,
  ImageGeneratorModule,
  StrapiModule,
];

const providers: any[] = [SchedulerService];

if (redisEnabled) {
  imports.push(
    BullModule.registerQueue({
      name: 'blog-generation',
    }),
  );
  providers.push(BlogJobProcessor);
} else {
  providers.push({
    provide: getQueueToken('blog-generation'),
    useValue: {
      add: async () => {
        return { id: 'mock-direct-job' };
      },
    },
  });
}

@Module({
  imports,
  providers,
  exports: [SchedulerService],
})
export class SchedulerModule {}
