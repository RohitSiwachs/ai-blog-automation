// ============================================================
// Application Entry Point
// Bootstraps the NestJS application with Winston logger
// and graceful shutdown handling.
// ============================================================

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Disable default logger — we use Winston
    logger: false,
  });

  // Use Winston as the NestJS logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // Set global prefix
  app.setGlobalPrefix('api');

  // CORS (optional, useful if you want to trigger via frontend)
  app.enableCors();

  const port = process.env.PORT || 3002;
  await app.listen(port, '0.0.0.0');

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

  const startupMsg = `🚀 AI Blog Automation Engine running on port ${port}`;
  const healthMsg = `📋 Health check: ${baseUrl}/api/health`;
  const triggerMsg = `🔧 Manual trigger: POST ${baseUrl}/api/trigger?count=1`;

  logger.log(startupMsg);
  logger.log(healthMsg);
  logger.log(triggerMsg);

  // Fallback to plain console for Render logs visibility
  console.log('--- Startup Summary ---');
  console.log(startupMsg);
  console.log(healthMsg);
  console.log(triggerMsg);
}

bootstrap();
