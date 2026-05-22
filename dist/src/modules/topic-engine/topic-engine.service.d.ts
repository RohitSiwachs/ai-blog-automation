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
    private genAI;
    private geminiModel;
    private nvidiaApiKey;
    private nvidiaModel;
    private nvidiaEndpoint;
    private aiProvider;
    private readonly FALLBACK_NVIDIA_MODEL;
    constructor(prisma: PrismaService, strapiService: StrapiService, configService: ConfigService, logger: Logger);
    generateTopics(count: number): Promise<GeneratedTopic[]>;
    private syncStrapiTopics;
    private generateAITopics;
    private generateAITopicsWithGemini;
    private generateAITopicsWithNvidia;
    private extractKeywords;
    private calculateOverlap;
    private getKeywordsForCluster;
}
