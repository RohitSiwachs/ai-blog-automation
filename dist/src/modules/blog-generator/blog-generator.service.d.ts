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
    private geminiModel;
    private nvidiaApiKey;
    private nvidiaModel;
    private nvidiaEndpoint;
    private aiProvider;
    private readonly FALLBACK_NVIDIA_MODEL;
    constructor(configService: ConfigService, logger: Logger);
    generateBlog(title: string, keywords: string[], categories: string[]): Promise<GeneratedBlog>;
    private generateWithGemini;
    private generateWithNvidia;
    private parseAIResponse;
    private truncate;
    private enrichInlineImages;
    private generateInlineSmartPrompt;
    humanizeContent(content: string): Promise<string>;
    private countWords;
}
