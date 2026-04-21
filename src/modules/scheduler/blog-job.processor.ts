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
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

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
    private readonly configService: ConfigService,
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

      // Fetch categories from Strapi for intelligent selection
      const categoriesList = await this.strapiService.fetchCategories();
      const categoryNames = categoriesList.map((c) => c.name);

      const blog = await this.blogGenerator.generateBlog(
        title,
        keywords || [],
        categoryNames,
      );

      // --- Step 1.5: Enrich Inline Images with NVIDIA ---
      this.logger.info(`BlogJob [${job.id}]: Step 1.5/4 — Enriching inline images with NVIDIA NIM...`);
      blog.content = await this.processInlineImages(blog.content, job.id?.toString() || 'unknown');

      // Map selected category name back to ID
      const selectedCategory = categoriesList.find(
        (c) => c.name.toLowerCase() === blog.category?.toLowerCase(),
      );
      const categoryId = selectedCategory ? selectedCategory.id : 1; // Default to ID 1 (Development)

      this.logger.info(`BlogJob [${job.id}]: Selected Category — "${blog.category}" (ID: ${categoryId})`);

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


      // --- Special Step: Save local preview if in bypass mode ---
      const isBypass = this.configService.get<boolean>('BYPASS_STRAPI') || false;
      if (isBypass) {
        const previewDir = path.join(process.cwd(), 'previews');
        if (!fs.existsSync(previewDir)) {
          fs.mkdirSync(previewDir, { recursive: true });
        }

        // Save blog content
        const contentPath = path.join(previewDir, `${blog.slug}.md`);
        fs.writeFileSync(contentPath, blog.content);

        // Save banner image
        const imagePath = path.join(previewDir, `${blog.slug}-banner.jpg`);
        fs.writeFileSync(imagePath, imageBuffer);

        this.logger.info(`📸 PREVIEW SAVED: file:///${contentPath.replace(/\\/g, '/')}`);
        this.logger.info(`🖼️ BANNER SAVED: file:///${imagePath.replace(/\\/g, '/')}`);
      }

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

      // Fetch authors and pick one randomly
      const authors = await this.strapiService.fetchAuthors();
      const randomAuthor = authors.length > 0 
        ? authors[Math.floor(Math.random() * authors.length)]
        : { id: 2, name: 'Nikhil Chauhan' }; // Fallback

      this.logger.info(`BlogJob [${job.id}]: Selected author — "${randomAuthor.name}" (ID: ${randomAuthor.id})`);

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
        authorId: randomAuthor.id,
        authorName: randomAuthor.name,
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
   * Scans content for Pollinations/Placeholder images, generates them via NVIDIA,
   * uploads them to Strapi, and replaces the URLs.
   */
  private async processInlineImages(content: string, jobId: string): Promise<string> {
    // Regex to find markdown images (specifically those generated as placeholders)
    const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g;
    const matches = Array.from(content.matchAll(imageRegex));
    
    if (matches.length === 0) return content;

    this.logger.info(`BlogJob [${jobId}]: Found ${matches.length} inline images to replace with NVIDIA...`);

    let updatedContent = content;
    
    for (let i = 0; i < matches.length; i++) {
      const [fullMatch, alt, url] = matches[i];
      
      try {
        // Use the alt text or prompt from URL as the NVIDIA prompt
        // Pollinations URLs often have the prompt in the path
        const promptMatch = url.match(/\/prompt\/([^?&]+)/);
        const nvidiaPrompt = promptMatch 
          ? decodeURIComponent(promptMatch[1]).replace(/-/g, ' ')
          : alt || 'professional office technology';

        this.logger.info(`BlogJob [${jobId}]: Generating NVIDIA image ${i+1}/${matches.length} for "${alt}"...`);
        
        // 1. Generate with NVIDIA
        const imageBuffer = await this.imageGenerator.generateNvidiaImage(nvidiaPrompt);
        
        if (imageBuffer) {
          // 2. Upload to Strapi
          const filename = `inline-${jobId}-${i}.jpg`;
          const mediaId = await this.strapiService.uploadImage(imageBuffer, filename);
          
          // 3. Get the actual Strapi URL for this image
          const mediaUrl = await this.strapiService.getMediaUrl(mediaId);
          
          if (mediaUrl) {
            updatedContent = updatedContent.replace(fullMatch, `![${alt}](${mediaUrl})`);
            this.logger.info(`BlogJob [${jobId}]: Inline image ${i+1} replaced successfully.`);
          }
        }
      } catch (err) {
        this.logger.warn(`BlogJob [${jobId}]: Failed to process inline image ${i+1}: ${err.message}. Keeping original.`);
      }
    }

    return updatedContent;
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
