"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const nest_winston_1 = require("nest-winston");
const ioredis_1 = __importDefault(require("ioredis"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
}
catch (e) {
    console.warn('⚠️ Failed to load .env manually:', e.message);
}
async function bootstrap() {
    const redisEnabledEnv = process.env.REDIS_ENABLED !== 'false';
    let redisAvailable = false;
    if (redisEnabledEnv) {
        const host = process.env.REDIS_HOST || 'localhost';
        const port = parseInt(process.env.REDIS_PORT || '6379', 10);
        const password = process.env.REDIS_PASSWORD || undefined;
        const tls = process.env.REDIS_TLS === 'true';
        console.log(`🔍 Redis Pre-check: Connecting to ${host}:${port}...`);
        const client = new ioredis_1.default({
            host,
            port,
            password,
            tls: tls ? {} : undefined,
            lazyConnect: true,
            maxRetriesPerRequest: 0,
            connectTimeout: 2000,
        });
        try {
            await client.connect();
            const ping = await client.ping();
            if (ping === 'PONG') {
                redisAvailable = true;
                console.log('✅ Redis Pre-check: SUCCESS! BullMQ will be enabled.');
            }
            await client.quit();
        }
        catch (error) {
            console.warn(`⚠️ Redis Pre-check: FAILED — ${error.message}`);
            console.warn('⚠️ BullMQ will be disabled. Falling back to DIRECT MODE.');
            try {
                client.disconnect();
            }
            catch { }
        }
    }
    else {
        console.log('⚠️ Redis Pre-check: REDIS_ENABLED=false configured. BullMQ is disabled.');
    }
    process.env.REDIS_AVAILABLE = redisAvailable ? 'true' : 'false';
    const { AppModule } = await import('./app.module.js');
    const app = await core_1.NestFactory.create(AppModule, {
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