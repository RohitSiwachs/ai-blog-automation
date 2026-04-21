// ============================================================
// Strapi CMS Service
// Handles all API interactions with blog.innovaft.com Strapi:
// - Media uploads (cover images)
// - Article creation (with SEO, blocks, tags, author, category)
// - Fetching recent articles for deduplication
// - Automatic retry with exponential backoff
// ============================================================

import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import slugify from 'slugify';

/** Shape of the blog data sent to Strapi */
export interface StrapiBlogPayload {
  title: string;
  description: string; // Short excerpt shown on blog listing
  slug: string;
  content: string; // Markdown — goes into blocks[].body
  metaTitle: string; // seo.metaTitle
  metaDescription: string; // seo.metaDescription
  ogTitle: string; // seo.ogTitle
  ogDescription: string; // seo.ogDescription
  metaKeywords: string; // seo.metaKeywords (comma-separated)
  keywords: string[]; // For structuredData
  tags: string[]; // Tags array e.g. ["AI", "Tools"]
  cover?: number; // Strapi media ID
  categoryId: number; // Relation to Category
  authorId: number; // Relation to Author
  authorName?: string; // For SEO structured data
}

/** Shape of an author entry from Strapi */
export interface StrapiAuthor {
  id: number;
  name: string;
}

/** Shape of a category entry from Strapi */
export interface StrapiCategory {
  id: number;
  name: string;
}

/** Shape of an article entry returned from Strapi */
export interface StrapiArticleEntry {
  id: number;
  title: string;
  slug: string;
  createdAt: string;
}

@Injectable()
export class StrapiService {
  private client: AxiosInstance;
  private readonly maxRetries = 3;
  private readonly retryBaseDelay = 1000;
  private readonly siteUrl: string;
  private readonly isBypass: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    const baseUrl = this.configService.get<string>('strapi.baseUrl');
    const apiToken = this.configService.get<string>('strapi.apiToken');
    this.siteUrl =
      this.configService.get<string>('strapi.siteUrl') ||
      'https://blog.innovaft.com';

    this.isBypass = this.configService.get<boolean>('strapi.bypassMode') || false;

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      timeout: 30000,
    });

    if (this.isBypass) {
      this.logger.warn('⚠️ Strapi: BYPASS MODE ACTIVE — Real API calls will be skipped.');
    } else {
      this.logger.info(`StrapiService: Initialized with base URL — ${baseUrl}`);
    }
  }

  /**
   * Upload an image buffer to Strapi media library.
   */
  async uploadImage(buffer: Buffer, filename: string): Promise<number> {
    if (this.isBypass) {
      this.logger.info(`Strapi: BYPASS - Mocking image upload for "${filename}"`);
      return 0;
    }
    this.logger.info(`Strapi: Uploading image "${filename}"...`);

    return this.withRetry(async () => {
      const formData = new FormData();
      formData.append('files', buffer, {
        filename,
        contentType: 'image/jpeg',
      });

      const response = await this.client.post('/api/upload', formData, {
        headers: { ...formData.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const mediaId = response.data[0].id;
      this.logger.info(
        `Strapi: Image uploaded successfully — ID: ${mediaId}, filename: "${filename}"`,
      );
      return mediaId;
    }, 'uploadImage');
  }

  /**
   * Fetch the full URL for a media ID from Strapi.
   */
  async getMediaUrl(id: number): Promise<string | null> {
    if (this.isBypass || id === 0) return 'https://via.placeholder.com/1200x630.png?text=Bypass+Mode';
    
    return this.withRetry(async () => {
      const response = await this.client.get(`/api/upload/files/${id}`);
      const url = response.data.url;
      // Ensure it's a full URL
      const baseUrl = this.configService.get<string>('strapi.baseUrl') || '';
      const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
      return fullUrl;
    }, 'getMediaUrl');
  }

  /**
   * Create a new article in Strapi (blog.innovaft.com schema).
   */
  async createBlogPost(data: StrapiBlogPayload): Promise<number> {
    if (this.isBypass) {
      this.logger.info(`Strapi: BYPASS - Mocking blog post creation for "${data.title}"`);
      return 0;
    }
    this.logger.info(`Strapi: Creating article "${data.title}"...`);

    return this.withRetry(async () => {
      const canonicalSlug = slugify(data.metaTitle, {
        lower: true,
        strict: true,
        trim: true,
      });

      const now = new Date().toISOString();

      // Build structured data (JSON-LD) for SEO
      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: data.metaTitle,
        description: data.metaDescription,
        keywords: data.keywords,
        image: data.cover
          ? `${this.siteUrl}/cover-image`
          : `${this.siteUrl}/images/default-cover.jpg`,
        author: {
          '@type': 'Person',
          name: data.authorName || 'Innovaft Team',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Innovaft',
          logo: {
            '@type': 'ImageObject',
            url: `${this.siteUrl}/logo.png`,
          },
        },
        datePublished: now,
        dateModified: now,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${this.siteUrl}/articles/${canonicalSlug}`,
        },
        articleSection: 'Technology',
      };

      const payload: any = {
        data: {
          title: data.title,
          description: data.description,
          blocks: [
            {
              __component: 'shared.rich-text',
              body: data.content,
            },
          ],
          author: { connect: [{ id: data.authorId }] },
          category: { connect: [{ id: data.categoryId }] },
          tags: data.tags.slice(0, 2).map((tag) => ({ tag })),
          seo: {
            metaTitle: data.metaTitle,
            metaDescription: data.metaDescription,
            metaKeywords: data.metaKeywords,
            canonicalUrl: `${this.siteUrl}/${canonicalSlug}`,
            metaRobots: 'index, follow',
            ogTitle: data.ogTitle,
            ogDescription: data.ogDescription,
            structuredData,
            ...(data.cover && { ogImage: data.cover }),
          },
        },
      };

      // Attach slug and cover image if available
      payload.data.slug = data.slug;
      if (data.cover) {
        payload.data.cover = data.cover;
      }

      const response = await this.client.post('/api/articles?status=published', payload);
      const articleId = response.data.data.id;

      this.logger.info(
        `Strapi: Article created successfully — ID: ${articleId}, slug: "${data.slug}"`,
      );
      return articleId;
    }, 'createBlogPost');
  }

  /**
   * Fetch all available authors from Strapi.
   */
  async fetchAuthors(): Promise<StrapiAuthor[]> {
    if (this.isBypass) {
      this.logger.info(`Strapi: BYPASS - Returning mock authors`);
      return [{ id: 2, name: 'Nikhil Chauhan (MOCK)' }];
    }
    this.logger.info(`Strapi: Fetching authors...`);

    return this.withRetry(async () => {
      const response = await this.client.get('/api/authors');
      const authors: StrapiAuthor[] = (response.data.data || []).map(
        (entry: any) => ({
          id: entry.id,
          name: entry.attributes?.name || entry.name || 'Unknown Author',
        }),
      );

      const authorNames = authors.map(a => a.name).join(', ');
      this.logger.info(`Strapi: Fetched ${authors.length} authors: [${authorNames}]`);
      return authors;
    }, 'fetchAuthors');
  }

  /**
   * Fetch all available categories from Strapi.
   */
  async fetchCategories(): Promise<StrapiCategory[]> {
    if (this.isBypass) {
      this.logger.info(`Strapi: BYPASS - Returning mock categories`);
      return [{ id: 1, name: 'Development' }, { id: 2, name: 'Marketing' }];
    }
    this.logger.info(`Strapi: Fetching categories...`);

    return this.withRetry(async () => {
      const response = await this.client.get('/api/categories');
      const categories: StrapiCategory[] = (response.data.data || []).map(
        (entry: any) => ({
          id: entry.id,
          name: entry.name || 'Unknown Category',
        }),
      );

      this.logger.info(`Strapi: Fetched ${categories.length} categories`);
      return categories;
    }, 'fetchCategories');
  }

  /**
   * Fetch recent articles from Strapi for topic deduplication.
   */
  async fetchRecentBlogs(limit: number = 50): Promise<StrapiArticleEntry[]> {
    if (this.isBypass) {
      this.logger.info(`Strapi: BYPASS - Returning empty recent blogs list`);
      return [];
    }
    this.logger.info(`Strapi: Fetching last ${limit} articles...`);

    return this.withRetry(async () => {
      const response = await this.client.get('/api/articles', {
        params: {
          'pagination[limit]': limit,
          'sort[0]': 'createdAt:desc',
        },
      });

      const articles: StrapiArticleEntry[] = (response.data.data || []).map(
        (entry: any) => ({
          id: entry.id,
          title: entry.title || '',
          slug: entry.slug || '',
          createdAt: entry.createdAt || '',
        }),
      );

      this.logger.info(`Strapi: Fetched ${articles.length} recent articles`);
      return articles;
    }, 'fetchRecentBlogs');
  }

  /**
   * Execute an operation with automatic retry and exponential backoff.
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error = new Error('All retry attempts failed');

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const axiosError = error as AxiosError;
        const statusCode = axiosError.response?.status;
        const errorMessage = axiosError.message;

        this.logger.warn(
          `Strapi: ${operationName} failed (attempt ${attempt}/${this.maxRetries}) — ` +
            `Status: ${statusCode || 'N/A'}, Error: ${errorMessage}`,
        );

        // Don't retry on 4xx client errors (except 429 rate limit)
        if (
          statusCode &&
          statusCode >= 400 &&
          statusCode < 500 &&
          statusCode !== 429
        ) {
          this.logger.error(
            `Strapi: ${operationName} — Client error ${statusCode}, not retrying`,
          );
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryBaseDelay * Math.pow(2, attempt - 1);
          this.logger.info(
            `Strapi: Retrying ${operationName} in ${delay}ms...`,
          );
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(
      `Strapi: ${operationName} — All ${this.maxRetries} attempts exhausted`,
    );
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
