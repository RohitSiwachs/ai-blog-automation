// ============================================================
// Topic Engine Module
// ============================================================

import { Module } from '@nestjs/common';
import { TopicEngineService } from './topic-engine.service';
import { StrapiModule } from '../strapi-service/strapi.module';

@Module({
  imports: [StrapiModule],
  providers: [TopicEngineService],
  exports: [TopicEngineService],
})
export class TopicEngineModule {}
