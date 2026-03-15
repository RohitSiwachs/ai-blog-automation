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
    app.enableCors();
    const port = process.env.PORT || 3002;
    await app.listen(port);
    const logger = app.get(nest_winston_1.WINSTON_MODULE_NEST_PROVIDER);
    logger.log(`🚀 AI Blog Automation Engine running on port ${port}`);
    logger.log(`📋 Health check: http://localhost:${port}/health`);
    logger.log(`🔧 Manual trigger: POST http://localhost:${port}/trigger?count=1`);
}
bootstrap();
//# sourceMappingURL=main.js.map