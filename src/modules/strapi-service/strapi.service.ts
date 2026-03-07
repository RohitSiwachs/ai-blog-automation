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

  constructor(
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    const baseUrl = this.configService.get<string>('strapi.baseUrl');
    const apiToken = this.configService.get<string>('strapi.apiToken');
    this.siteUrl =
      this.configService.get<string>('strapi.siteUrl') ||
      'https://blog.innovaft.com';

    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
      timeout: 30000,
    });

    this.logger.info(`StrapiService: Initialized with base URL — ${baseUrl}`);
  }

  /**
   * Upload an image buffer to Strapi media library.
   */
  async uploadImage(buffer: Buffer, filename: string): Promise<number> {
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
   * Create a new article in Strapi (blog.innovaft.com schema).
   */
  async createBlogPost(data: StrapiBlogPayload): Promise<number> {
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
          name: data.authorId === 1 ? 'Ansh' : 'Nikhil Chauhan',
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
   * Fetch recent articles from Strapi for topic deduplication.
   */
  async fetchRecentBlogs(limit: number = 50): Promise<StrapiArticleEntry[]> {
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
