import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

// --- Manual .env loader (for pre-startup environment parsing) ---
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    for (const line of envConfig.split('\n')) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (e) {
  console.warn('⚠️ Failed to load .env manually:', e.message);
}

async function bootstrap() {
  // --- Pre-startup Redis Check ---
  const redisEnabledEnv = process.env.REDIS_ENABLED !== 'false';
  let redisAvailable = false;

  if (redisEnabledEnv) {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;
    const tls = process.env.REDIS_TLS === 'true';

    console.log(`🔍 Redis Pre-check: Connecting to ${host}:${port}...`);

    const client = new Redis({
      host,
      port,
      password,
      tls: tls ? {} : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      connectTimeout: 2000, // 2-second timeout
    });

    try {
      await client.connect();
      const ping = await client.ping();
      if (ping === 'PONG') {
        redisAvailable = true;
        console.log('✅ Redis Pre-check: SUCCESS! BullMQ will be enabled.');
      }
      await client.quit();
    } catch (error) {
      console.warn(`⚠️ Redis Pre-check: FAILED — ${error.message}`);
      console.warn('⚠️ BullMQ will be disabled. Falling back to DIRECT MODE.');
      try {
        client.disconnect();
      } catch {}
    }
  } else {
    console.log('⚠️ Redis Pre-check: REDIS_ENABLED=false configured. BullMQ is disabled.');
  }

  process.env.REDIS_AVAILABLE = redisAvailable ? 'true' : 'false';

  // Dynamically load AppModule so that process.env.REDIS_AVAILABLE is set before decorator execution!
  const { AppModule } = await import('./app.module.js');

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
