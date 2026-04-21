import { ConfigService } from '@nestjs/config';
import { Logger } from 'winston';
export interface StrapiBlogPayload {
    title: string;
    description: string;
    slug: string;
    content: string;
    metaTitle: string;
    metaDescription: string;
    ogTitle: string;
    ogDescription: string;
    metaKeywords: string;
    keywords: string[];
    tags: string[];
    cover?: number;
    categoryId: number;
    authorId: number;
    authorName?: string;
}
export interface StrapiAuthor {
    id: number;
    name: string;
}
export interface StrapiCategory {
    id: number;
    name: string;
}
export interface StrapiArticleEntry {
    id: number;
    title: string;
    slug: string;
    createdAt: string;
}
export declare class StrapiService {
    private readonly configService;
    private readonly logger;
    private client;
    private readonly maxRetries;
    private readonly retryBaseDelay;
    private readonly siteUrl;
    private readonly isBypass;
    constructor(configService: ConfigService, logger: Logger);
    uploadImage(buffer: Buffer, filename: string): Promise<number>;
    createBlogPost(data: StrapiBlogPayload): Promise<number>;
    fetchAuthors(): Promise<StrapiAuthor[]>;
    fetchCategories(): Promise<StrapiCategory[]>;
    fetchRecentBlogs(limit?: number): Promise<StrapiArticleEntry[]>;
    private withRetry;
    private sleep;
}
