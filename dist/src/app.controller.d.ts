import { Logger } from 'winston';
import { SchedulerService } from './modules/scheduler/scheduler.service';
export declare class AppController {
    private readonly schedulerService;
    private readonly logger;
    constructor(schedulerService: SchedulerService, logger: Logger);
    index(): {
        message: string;
        documentation: string;
        trigger: string;
    };
    getHealth(): {
        status: string;
        service: string;
        timestamp: string;
        uptime: number;
    };
    triggerBatch(count?: string): Promise<{
        success: boolean;
        message: string;
        jobCount: string | number;
        timestamp: string;
    }>;
}
