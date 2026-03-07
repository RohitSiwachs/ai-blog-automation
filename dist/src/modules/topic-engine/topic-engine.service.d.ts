import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
import { PrismaService } from '../../prisma/prisma.service';
import { StrapiService } from '../strapi-service/strapi.service';
export interface GeneratedTopic {
    title: string;
    slug: string;
    keywords: string[];
    cluster: string;
}
export declare class TopicEngineService {
    private readonly prisma;
    private readonly strapiService;
    private readonly configService;
    private readonly logger;
    constructor(prisma: PrismaService, strapiService: StrapiService, configService: ConfigService, logger: Logger);
    generateTopics(count: number): Promise<GeneratedTopic[]>;
    private syncStrapiTopics;
    private extractKeywords;
    private calculateOverlap;
    private getKeywordsForCluster;
}
