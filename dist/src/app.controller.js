"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const nest_winston_1 = require("nest-winston");
const winston_1 = require("winston");
const scheduler_service_1 = require("./modules/scheduler/scheduler.service");
let AppController = class AppController {
    schedulerService;
    logger;
    constructor(schedulerService, logger) {
        this.schedulerService = schedulerService;
        this.logger = logger;
    }
    index() {
        return {
            message: 'AI Blog Automation Engine is running!',
            documentation: '/api/health',
            trigger: '/api/trigger?count=1',
        };
    }
    getHealth() {
        return {
            status: 'ok',
            service: 'AI Blog Automation Engine',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        };
    }
    async triggerBatch(count) {
        this.logger.info(`Manual trigger received — count: ${count || 'default'}`);
        const jobCount = count ? parseInt(count, 10) : undefined;
        const result = await this.schedulerService.triggerManualBatch(jobCount);
        return {
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        };
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "index", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "getHealth", null);
__decorate([
    (0, common_1.Post)('trigger'),
    __param(0, (0, common_1.Query)('count')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AppController.prototype, "triggerBatch", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __param(1, (0, common_1.Inject)(nest_winston_1.WINSTON_MODULE_PROVIDER)),
    __metadata("design:paramtypes", [scheduler_service_1.SchedulerService,
        winston_1.Logger])
], AppController);
//# sourceMappingURL=app.controller.js.map