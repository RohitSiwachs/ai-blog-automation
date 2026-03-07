// ============================================================
// Blog Job Processor
// BullMQ processor that handles individual blog generation jobs.
// Each job goes through the full pipeline:
// Topic → Content → Image → Upload → Publish
// ============================================================

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { BlogGeneratorService } from '../blog-generator/blog-generator.service';
import { ImageGeneratorService } from '../image-generator/image-generator.service';
import { StrapiService } from '../strapi-service/strapi.service';

/** Job data shape */
export interface BlogJobData {
  title: string;
  slug: string;
  keywords: string[];
  cluster: string;
  blogLogId: number;
}

@Processor('blog-generation', {
  concurrency: 1, // Process one blog at a time to avoid API rate limits
})
export class BlogJobProcessor extends WorkerHost {
  constructor(
    private readonly blogGenerator: BlogGeneratorService,
    private readonly imageGenerator: ImageGeneratorService,
    private readonly strapiService: StrapiService,
    private readonly prisma: PrismaService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    super();
  }

  /**
   * Process a single blog generation job.
   * Full pipeline: generate content → generate image → upload image → create post.
   */
  async process(job: Job<BlogJobData>): Promise<void> {
    const { title, slug, keywords, blogLogId } = job.data;

    this.logger.info(
      `🚀 BlogJob [${job.id}]: Starting processing — "${title}"`,
    );

    try {
      // --- Update status to "generating" ---
      await this.updateBlogLog(blogLogId, {
        status: 'generating',
        attempts: job.attemptsMade + 1,
      });

      // --- Step 1: Generate blog content with Gemini AI ---
      await job.updateProgress(10);
      this.logger.info(`BlogJob [${job.id}]: Step 1/4 — Generating content...`);

      const blog = await this.blogGenerator.generateBlog(title, keywords);

      await job.updateProgress(40);
      this.logger.info(
        `BlogJob [${job.id}]: Content generated — "${blog.seoTitle}"`,
      );

      // --- Step 2: Generate banner image ---
      this.logger.info(
        `BlogJob [${job.id}]: Step 2/4 — Generating banner image...`,
      );

      const imageBuffer = await this.imageGenerator.generateBannerImage(
        blog.seoTitle,
      );

      await job.updateProgress(60);
      this.logger.info(`BlogJob [${job.id}]: Banner image generated`);

      // --- Step 3: Upload image to Strapi ---
      this.logger.info(
        `BlogJob [${job.id}]: Step 3/4 — Uploading image to Strapi...`,
      );

      const imageFilename = `${slug}-banner.jpg`;
      const mediaId = await this.strapiService.uploadImage(
        imageBuffer,
        imageFilename,
      );

      await job.updateProgress(80);
      this.logger.info(
        `BlogJob [${job.id}]: Image uploaded — Media ID: ${mediaId}`,
      );

      // --- Step 4: Create article in Strapi ---
      this.logger.info(`BlogJob [${job.id}]: Step 4/4 — Publishing article...`);

      // Map topic cluster to Strapi category ID
      const designClusters = ['design', 'ui-ux', 'designing'];
      const categoryId = designClusters.includes(
        job.data.cluster?.toLowerCase(),
      )
        ? 2 // Designing
        : 1; // Development (default)

      const strapiId = await this.strapiService.createBlogPost({
        title: blog.seoTitle,
        description: blog.description,
        slug: blog.slug,
        content: blog.content,
        metaTitle: blog.seoTitle,
        metaDescription: blog.metaDescription,
        ogTitle: blog.ogTitle,
        ogDescription: blog.ogDescription,
        metaKeywords: blog.metaKeywords,
        keywords: job.data.keywords || [],
        tags: blog.tags,
        cover: mediaId,
        authorId: 2, // Nikhil Chauhan
        categoryId,
      });

      await job.updateProgress(100);

      // --- Update BlogLog as published ---
      await this.updateBlogLog(blogLogId, {
        status: 'published',
        strapiId,
        imageId: mediaId,
        title: blog.seoTitle,
        slug: blog.slug,
      });

      this.logger.info(
        `✅ BlogJob [${job.id}]: Successfully published — ` +
          `Strapi ID: ${strapiId}, slug: "${blog.slug}"`,
      );
    } catch (error) {
      this.logger.error(`❌ BlogJob [${job.id}]: Failed — ${error.message}`);

      // Update BlogLog with error
      await this.updateBlogLog(blogLogId, {
        status: 'failed',
        error: error.message,
        attempts: job.attemptsMade + 1,
      });

      // Re-throw to let BullMQ handle retries
      throw error;
    }
  }

  /**
   * Update a BlogLog entry in the database.
   */
  private async updateBlogLog(
    id: number,
    data: {
      status?: string;
      strapiId?: number;
      imageId?: number;
      title?: string;
      slug?: string;
      error?: string;
      attempts?: number;
    },
  ): Promise<void> {
    try {
      await this.prisma.blogLog.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.logger.warn(
        `BlogJob: Failed to update BlogLog ${id} — ${error.message}`,
      );
    }
  }
}
