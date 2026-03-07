// ============================================================
// Blog Generator Module
// ============================================================

import { Module } from '@nestjs/common';
import { BlogGeneratorService } from './blog-generator.service';

@Module({
  providers: [BlogGeneratorService],
  exports: [BlogGeneratorService],
})
export class BlogGeneratorModule {}
