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

  // CORS (optional, useful if you want to trigger via frontend)
  app.enableCors();

  const port = process.env.PORT || 3002;
  await app.listen(port, '0.0.0.0');

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`🚀 AI Blog Automation Engine running on port ${port}`);
  logger.log(`📋 Health check: http://localhost:${port}/health`);
  logger.log(
    `🔧 Manual trigger: POST http://localhost:${port}/trigger?count=1`,
  );
}

bootstrap();
