import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from 'winston';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { BlogGeneratorService } from '../blog-generator/blog-generator.service';
import { ImageGeneratorService } from '../image-generator/image-generator.service';
import { StrapiService } from '../strapi-service/strapi.service';
export interface BlogJobData {
    title: string;
    slug: string;
    keywords: string[];
    cluster: string;
    blogLogId: number;
}
export declare class BlogJobProcessor extends WorkerHost {
    private readonly blogGenerator;
    private readonly imageGenerator;
    private readonly strapiService;
    private readonly prisma;
    private readonly logger;
    constructor(blogGenerator: BlogGeneratorService, imageGenerator: ImageGeneratorService, strapiService: StrapiService, prisma: PrismaService, logger: Logger);
    process(job: Job<BlogJobData>): Promise<void>;
    private updateBlogLog;
}
