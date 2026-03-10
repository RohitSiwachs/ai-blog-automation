import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
export interface GeneratedBlog {
    seoTitle: string;
    metaDescription: string;
    ogTitle: string;
    ogDescription: string;
    metaKeywords: string;
    description: string;
    category: string;
    tags: string[];
    slug: string;
    content: string;
}
export declare class BlogGeneratorService {
    private readonly configService;
    private readonly logger;
    private genAI;
    private modelName;
    constructor(configService: ConfigService, logger: Logger);
    generateBlog(title: string, keywords: string[], categories: string[]): Promise<GeneratedBlog>;
    private parseGeminiResponse;
    private truncate;
    private randomizeInlineImages;
    private countWords;
}
