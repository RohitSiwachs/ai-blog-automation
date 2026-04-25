"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const nest_winston_1 = require("nest-winston");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: false,
    });
    app.useLogger(app.get(nest_winston_1.WINSTON_MODULE_NEST_PROVIDER));
    app.enableShutdownHooks();
    app.setGlobalPrefix('api');
    app.enableCors();
    const port = process.env.PORT || 3002;
    await app.listen(port, '0.0.0.0');
    const logger = app.get(nest_winston_1.WINSTON_MODULE_NEST_PROVIDER);
    const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
    const startupMsg = `🚀 AI Blog Automation Engine running on port ${port}`;
    const healthMsg = `📋 Health check: ${baseUrl}/api/health`;
    const triggerMsg = `🔧 Manual trigger: POST ${baseUrl}/api/trigger?count=1`;
    logger.log(startupMsg);
    logger.log(healthMsg);
    logger.log(triggerMsg);
    console.log('--- Startup Summary ---');
    console.log(startupMsg);
    console.log(healthMsg);
    console.log(triggerMsg);
}
bootstrap();
//# sourceMappingURL=main.js.map