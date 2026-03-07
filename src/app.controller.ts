// ============================================================
// App Controller
// Provides HTTP endpoints for health checks and manual triggers.
// ============================================================

import { Controller, Get, Post, Query, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { SchedulerService } from './modules/scheduler/scheduler.service';

@Controller()
export class AppController {
  constructor(
    private readonly schedulerService: SchedulerService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * Health check endpoint.
   * GET /health
   */
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'AI Blog Automation Engine',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Manually trigger a blog generation batch.
   * POST /trigger?count=3
   *
   * @param count - Number of posts to generate (default: configured POSTS_PER_DAY)
   */
  @Post('trigger')
  async triggerBatch(@Query('count') count?: string) {
    this.logger.info(`Manual trigger received — count: ${count || 'default'}`);

    const jobCount = count ? parseInt(count, 10) : undefined;
    const result = await this.schedulerService.triggerManualBatch(jobCount);

    return {
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    };
  }
}
