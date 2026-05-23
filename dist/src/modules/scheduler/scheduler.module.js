"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const scheduler_service_1 = require("./scheduler.service");
const blog_job_processor_1 = require("./blog-job.processor");
const topic_engine_module_1 = require("../topic-engine/topic-engine.module");
const blog_generator_module_1 = require("../blog-generator/blog-generator.module");
const image_generator_module_1 = require("../image-generator/image-generator.module");
const strapi_module_1 = require("../strapi-service/strapi.module");
const redisEnabled = process.env.REDIS_ENABLED !== 'false';
const imports = [
    topic_engine_module_1.TopicEngineModule,
    blog_generator_module_1.BlogGeneratorModule,
    image_generator_module_1.ImageGeneratorModule,
    strapi_module_1.StrapiModule,
];
const providers = [scheduler_service_1.SchedulerService];
if (redisEnabled) {
    imports.push(bullmq_1.BullModule.registerQueue({
        name: 'blog-generation',
    }));
    providers.push(blog_job_processor_1.BlogJobProcessor);
}
else {
    providers.push({
        provide: (0, bullmq_1.getQueueToken)('blog-generation'),
        useValue: {
            add: async () => {
                return { id: 'mock-direct-job' };
            },
        },
    });
}
let SchedulerModule = class SchedulerModule {
};
exports.SchedulerModule = SchedulerModule;
exports.SchedulerModule = SchedulerModule = __decorate([
    (0, common_1.Module)({
        imports,
        providers,
        exports: [scheduler_service_1.SchedulerService],
    })
], SchedulerModule);
//# sourceMappingURL=scheduler.module.js.map