// ============================================================
// Prisma Service
// Manages the database connection lifecycle.
// ============================================================

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma 7 requires a driver adapter for direct DB connections.
    // Using @prisma/adapter-pg with the DATABASE_URL env variable.
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }

  /**
   * Connect to the database when the module initializes.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Gracefully disconnect when the application shuts down.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
