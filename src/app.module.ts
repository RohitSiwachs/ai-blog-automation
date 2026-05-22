// ============================================================
// App Module — Root Module
// Imports and wires all application modules together.
// ============================================================

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { LoggerModule } from './logger/logger.module';
import { PrismaModule } from './prisma/prisma.module';
import { TopicEngineModule } from './modules/topic-engine/topic-engine.module';
import { BlogGeneratorModule } from './modules/blog-generator/blog-generator.module';
import { ImageGeneratorModule } from './modules/image-generator/image-generator.module';
import { StrapiModule } from './modules/strapi-service/strapi.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    // --- Configuration (loads .env and typed config) ---
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // --- Cron Scheduling ---
    ScheduleModule.forRoot(),

    // --- BullMQ (Redis-backed job queue) ---
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisEnabled = configService.get<string>('redis.enabled') !== 'false';

        if (!redisEnabled) {
          console.warn('⚠️  REDIS_ENABLED=false — BullMQ running in disconnected mode. Jobs will NOT be processed.');
          return {
            connection: {
              host: '127.0.0.1',
              port: 6379,
              maxRetriesPerRequest: 0,
              lazyConnect: true,
              enableOfflineQueue: false,
            },
          };
        }

        return {
          connection: {
            host: configService.get<string>('redis.host'),
            port: configService.get<number>('redis.port'),
            password: configService.get<string>('redis.password'),
            tls: configService.get<boolean>('redis.tls') ? {} : undefined,
            maxRetriesPerRequest: 3,      // Stop retrying after 3 failures (prevents infinite loop)
            enableOfflineQueue: false,     // Don't queue requests when Redis is unreachable
            retryStrategy: (times: number) => {
              if (times > 5) {
                console.error('❌ Redis: Max reconnection attempts reached. Giving up.');
                return null; // Stop retrying
              }
              return Math.min(times * 2000, 30000); // 2s, 4s, 6s... up to 30s
            },
          },
        };
      },
      inject: [ConfigService],
    }),

    // --- Application Modules ---
    LoggerModule,
    PrismaModule,
    TopicEngineModule,
    BlogGeneratorModule,
    ImageGeneratorModule,
    StrapiModule,
    SchedulerModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
