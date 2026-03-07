// ============================================================
// Logger Module
// Configures Winston with console + file transports for
// structured, production-grade logging.
// ============================================================

import { Module } from '@nestjs/common';
import {
  WinstonModule,
  utilities as nestWinstonModuleUtilities,
} from 'nest-winston';
import * as winston from 'winston';

@Module({
  imports: [
    WinstonModule.forRoot({
      transports: [
        // --- Console transport (colorized, human-readable) ---
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike('BlogAutomation', {
              colors: true,
              prettyPrint: true,
            }),
          ),
        }),

        // --- File transport (JSON, structured for log aggregation) ---
        new winston.transports.File({
          filename: 'logs/automation.log',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
          maxsize: 10 * 1024 * 1024, // 10 MB rotation
          maxFiles: 5,
        }),

        // --- Error-only file transport ---
        new winston.transports.File({
          filename: 'logs/errors.log',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
          maxsize: 5 * 1024 * 1024,
          maxFiles: 3,
        }),
      ],
    }),
  ],
})
export class LoggerModule {}
