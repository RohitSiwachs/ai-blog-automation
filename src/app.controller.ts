// ============================================================
//app
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
   * Root endpoint.
   * Redirects or informs the user about the API prefix.
   */
  @Get()
  index() {
    return {
      message: 'AI Blog Automation Engine is running!',
      documentation: '/api/health',
      trigger: '/api/trigger?count=1',
    };
  }

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
   * GET /trigger?count=3 (Added for easy browser testing and uptime service compatibility)
   *
   * @param count - Number of posts to generate (default: configured POSTS_PER_DAY)
   */
  @Post('trigger')
  @Get('trigger')
  async triggerBatch(@Query('count') count?: string) {
    this.logger.info(`Manual trigger received — count: ${count || 'default'}`);

    const jobCount = count ? parseInt(count, 10) : undefined;

    // Trigger the batch asynchronously in the background so the HTTP
    // request completes instantly (preventing connection timeouts).
    this.schedulerService.triggerManualBatch(jobCount)
      .then((result) => {
        this.logger.info(`Background manual batch completed: ${result.message}`);
      })
      .catch((error) => {
        this.logger.error(`Background manual batch failed: ${error.message}`);
      });

    return {
      success: true,
      message: `Manual batch triggered successfully in the background.`,
      jobCount: jobCount || 'default',
      timestamp: new Date().toISOString(),
    };
  }
}
