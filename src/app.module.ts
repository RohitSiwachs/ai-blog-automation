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
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
        },
      }),
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
