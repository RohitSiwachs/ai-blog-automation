"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const bullmq_1 = require("@nestjs/bullmq");
const configuration_1 = __importDefault(require("./config/configuration"));
const logger_module_1 = require("./logger/logger.module");
const prisma_module_1 = require("./prisma/prisma.module");
const topic_engine_module_1 = require("./modules/topic-engine/topic-engine.module");
const blog_generator_module_1 = require("./modules/blog-generator/blog-generator.module");
const image_generator_module_1 = require("./modules/image-generator/image-generator.module");
const strapi_module_1 = require("./modules/strapi-service/strapi.module");
const scheduler_module_1 = require("./modules/scheduler/scheduler.module");
const app_controller_1 = require("./app.controller");
const redisEnabled = process.env.REDIS_ENABLED !== 'false' && process.env.REDIS_AVAILABLE === 'true';
const imports = [
    config_1.ConfigModule.forRoot({
        isGlobal: true,
        load: [configuration_1.default],
        envFilePath: '.env',
    }),
    schedule_1.ScheduleModule.forRoot(),
    logger_module_1.LoggerModule,
    prisma_module_1.PrismaModule,
    topic_engine_module_1.TopicEngineModule,
    blog_generator_module_1.BlogGeneratorModule,
    image_generator_module_1.ImageGeneratorModule,
    strapi_module_1.StrapiModule,
    scheduler_module_1.SchedulerModule,
];
if (redisEnabled) {
    imports.push(bullmq_1.BullModule.forRootAsync({
        imports: [config_1.ConfigModule],
        useFactory: (configService) => {
            return {
                connection: {
                    host: configService.get('redis.host'),
                    port: configService.get('redis.port'),
                    password: configService.get('redis.password'),
                    tls: configService.get('redis.tls') ? {} : undefined,
                    maxRetriesPerRequest: 3,
                    enableOfflineQueue: false,
                    retryStrategy: (times) => {
                        if (times > 5) {
                            console.error('❌ Redis: Max reconnection attempts reached. Giving up.');
                            return null;
                        }
                        return Math.min(times * 2000, 30000);
                    },
                },
            };
        },
        inject: [config_1.ConfigService],
    }));
}
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports,
        controllers: [app_controller_1.AppController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map